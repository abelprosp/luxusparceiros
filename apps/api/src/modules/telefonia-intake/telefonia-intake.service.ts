import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SaleContractStage, SaleStatus, SaleTaskSyncStatus } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { PrismaService } from '@/prisma/prisma.service';
import {
  buildTelefoniaSalePayload,
  telefoniaIntakeUrl,
  TelefoniaAttachmentSource,
} from './telefonia-intake.payload';

const MAX_FILE_BYTES = 8_000_000;
const MAX_TOTAL_BYTES = 16_000_000;
const ACCEPTED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class TelefoniaIntakeService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processQueue(), 20_000);
    this.timer.unref();
    setImmediate(() => void this.processQueue());
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  isConfigured() {
    return Boolean(this.endpoint && this.apiKey);
  }

  async enqueue(saleId: string) {
    await this.prisma.sale.updateMany({
      where: {
        id: saleId,
        billedByLuxus: true,
        telefoniaSyncStatus: { not: SaleTaskSyncStatus.SYNCED },
      },
      data: {
        telefoniaSyncStatus: SaleTaskSyncStatus.PENDING,
        telefoniaNextRetryAt: new Date(),
        telefoniaSyncError: null,
      },
    });
  }

  private get endpoint() {
    const raw = this.config.get<string>('TELEFONIA_INTAKE_URL')?.trim();
    return raw ? telefoniaIntakeUrl(raw) : '';
  }

  private get apiKey() {
    return this.config.get<string>('TELEFONIA_INTAKE_API_KEY')?.trim() ?? '';
  }

  private get timeoutMs() {
    const configured = Number(this.config.get<string>('TELEFONIA_INTAKE_TIMEOUT_MS'));
    return Number.isFinite(configured) && configured >= 5_000 ? configured : 90_000;
  }

  private async processQueue() {
    if (this.running || !this.isConfigured()) return;
    this.running = true;
    try {
      await this.prisma.sale.updateMany({
        where: {
          telefoniaSyncStatus: SaleTaskSyncStatus.PROCESSING,
          telefoniaNextRetryAt: { lte: new Date() },
        },
        data: {
          telefoniaSyncStatus: SaleTaskSyncStatus.RETRY,
          telefoniaNextRetryAt: new Date(),
        },
      });
      const candidates = await this.prisma.sale.findMany({
        where: {
          status: SaleStatus.ACTIVATED,
          contractStage: SaleContractStage.COMPLETED,
          billedByLuxus: true,
          telefoniaSyncStatus: {
            in: [SaleTaskSyncStatus.NOT_READY, SaleTaskSyncStatus.PENDING, SaleTaskSyncStatus.RETRY],
          },
          OR: [{ telefoniaNextRetryAt: null }, { telefoniaNextRetryAt: { lte: new Date() } }],
        },
        select: { id: true },
        take: 3,
        orderBy: [{ telefoniaNextRetryAt: 'asc' }, { activatedAt: 'asc' }],
      });
      for (const candidate of candidates) await this.sendSale(candidate.id);
    } catch (error) {
      console.warn('[telefonia-intake] Falha ao percorrer a fila', error);
    } finally {
      this.running = false;
    }
  }

  private async sendSale(id: string) {
    const claimed = await this.prisma.sale.updateMany({
      where: {
        id,
        status: SaleStatus.ACTIVATED,
        contractStage: SaleContractStage.COMPLETED,
        billedByLuxus: true,
        telefoniaSyncStatus: {
          in: [SaleTaskSyncStatus.NOT_READY, SaleTaskSyncStatus.PENDING, SaleTaskSyncStatus.RETRY],
        },
      },
      data: {
        telefoniaSyncStatus: SaleTaskSyncStatus.PROCESSING,
        telefoniaNextRetryAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    if (claimed.count !== 1) return;

    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        client: true,
        partner: { select: { name: true } },
        branch: { select: { name: true } },
        operator: { select: { name: true } },
        plan: { select: { name: true } },
        line: { select: { number: true } },
        simCard: { select: { iccid: true } },
        upgradeOfSale: { select: { protocol: true } },
        documents: {
          select: { id: true, name: true, type: true, mimeType: true, url: true },
        },
      },
    });
    if (!sale || !sale.client?.name?.trim()) {
      await this.markRetry(id, 'A venda concluída não tem cliente para enviar ao telefonia-2.');
      return;
    }

    const { attachments, notes } = this.readAttachments(sale.documents);
    const payload = buildTelefoniaSalePayload(sale, attachments, notes);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null) as {
        customer_id?: string;
        customerId?: string;
        message?: string;
        messages?: Array<{ message?: string }>;
      } | null;
      if (!response.ok) {
        const message = body?.messages?.map((item) => item.message).filter(Boolean).join(' ')
          || body?.message
          || `telefonia-2 respondeu HTTP ${response.status}`;
        await this.markRetry(id, message);
        return;
      }
      await this.prisma.sale.update({
        where: { id },
        data: {
          telefoniaSyncStatus: SaleTaskSyncStatus.SYNCED,
          telefoniaSyncError: null,
          telefoniaLastSyncAt: new Date(),
          telefoniaNextRetryAt: null,
          telefoniaCustomerId: body?.customer_id || body?.customerId || null,
          timeline: {
            create: {
              action: 'Cliente enviado ao telefonia-2',
              details: body?.customerId ? `Cliente ${body.customerId}` : 'Cadastro aceito.',
            },
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'O telefonia-2 demorou para responder. A venda continua concluída e o envio será tentado de novo.'
        : error instanceof Error
          ? error.message
          : 'Falha ao enviar a venda ao telefonia-2.';
      await this.markRetry(id, message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async markRetry(id: string, message: string) {
    const current = await this.prisma.sale.findUnique({
      where: { id },
      select: { telefoniaSyncAttempts: true },
    });
    const attempts = (current?.telefoniaSyncAttempts ?? 0) + 1;
    await this.prisma.sale.update({
      where: { id },
      data: {
        telefoniaSyncStatus: SaleTaskSyncStatus.RETRY,
        telefoniaSyncAttempts: attempts,
        telefoniaSyncError: message.slice(0, 2000),
        telefoniaNextRetryAt: new Date(Date.now() + this.retryDelayMs(attempts)),
      },
    });
    console.warn('[telefonia-intake] Envio adiado', id, message);
  }

  private retryDelayMs(attempts: number) {
    return Math.min(15 * 60_000, 30_000 * 2 ** Math.min(attempts, 5));
  }

  private uploadDir() {
    return this.config.get<string>('UPLOAD_DIR')
      || this.config.get<string>('RAILWAY_VOLUME_MOUNT_PATH')
      || './uploads';
  }

  private readAttachments(documents: Array<{ id: string; name: string; type: string; mimeType: string; url: string }>) {
    const attachments: TelefoniaAttachmentSource[] = [];
    const notes: string[] = [];
    let total = 0;
    for (const document of documents) {
      const file = this.readUpload(document.url);
      if (!file) {
        notes.push(`Anexo não enviado: ${document.name}. O arquivo não estava disponível no Parceiros.`);
        continue;
      }
      if (!ACCEPTED_MIME.has((document.mimeType || '').toLowerCase())) {
        notes.push(`Anexo não enviado: ${document.name}. O telefonia-2 aceita PDF, JPEG, PNG e WebP.`);
        continue;
      }
      if (file.byteLength > MAX_FILE_BYTES || total + file.byteLength > MAX_TOTAL_BYTES || attachments.length >= 10) {
        notes.push(`Anexo não enviado: ${document.name}. Passou do tamanho aceito pelo telefonia-2.`);
        continue;
      }
      total += file.byteLength;
      attachments.push({
        id: document.id,
        type: document.type,
        name: document.name,
        mimeType: document.mimeType,
        contentBase64: file.toString('base64'),
      });
    }
    return { attachments, notes };
  }

  private readUpload(url: string) {
    if (!url?.includes('uploads/')) return null;
    const relative = url.includes('/uploads/')
      ? url.slice(url.indexOf('/uploads/') + '/uploads/'.length)
      : url.startsWith('uploads/')
        ? url.slice('uploads/'.length)
        : basename(url);
    const candidates = [
      join(this.uploadDir(), basename(relative)),
      join(this.uploadDir(), relative.replace(/^\/+/, '')),
      join(process.cwd(), 'uploads', basename(relative)),
    ];
    const path = candidates.find((candidate) => existsSync(candidate));
    if (!path) return null;
    const file = readFileSync(path);
    return file.length ? file : null;
  }
}
