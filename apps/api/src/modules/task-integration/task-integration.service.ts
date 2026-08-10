import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { SaleContractStage } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { TaskDemandCallbackDto, CreateTaskDemandInput } from './dto/task-integration.dto';

export interface TaskResponsible {
  id: string;
  name: string;
  email: string;
}

export interface TaskClient {
  id: string;
  name: string;
  document?: string;
  tradeName?: string;
  personType?: string;
}

export interface CreatedTaskDemand {
  id: string;
  protocol: string;
  status: string;
  responsible?: TaskResponsible;
  client?: TaskClient;
  updatedAt?: string;
  workflowStage?: string;
  resolution?: string;
  observations?: string[];
  attachments?: Array<{ id: string; name: string; mimeType?: string; size?: number; createdAt?: string }>;
  isBeingEdited?: boolean;
  editorName?: string;
  editorActivity?: string;
  editorLastSeenAt?: string;
}

@Injectable()
export class TaskIntegrationService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.integrationKey);
  }

  async listResponsibles(): Promise<TaskResponsible[]> {
    return this.request<TaskResponsible[]>('/integrations/luxus-parceiros/responsaveis');
  }

  async listClients(search?: string): Promise<TaskClient[]> {
    const query = search?.trim()
      ? `?search=${encodeURIComponent(search.trim())}`
      : '';
    return this.request<TaskClient[]>(
      `/integrations/luxus-parceiros/clientes${query}`,
    );
  }

  async createDemand(input: CreateTaskDemandInput): Promise<CreatedTaskDemand> {
    return this.request<CreatedTaskDemand>('/integrations/luxus-parceiros/demandas', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getDemand(externalRequestId: string): Promise<CreatedTaskDemand> {
    return this.request(
      `/integrations/luxus-parceiros/demandas/${encodeURIComponent(externalRequestId)}`,
      undefined,
      10_000,
    );
  }

  async addDemandComment(
    externalRequestId: string,
    content: string,
    authorName: string,
  ) {
    return this.request(
      `/integrations/luxus-parceiros/demandas/${encodeURIComponent(externalRequestId)}/comentarios`,
      {
        method: 'POST',
        body: JSON.stringify({ content, authorName }),
      },
    );
  }

  async updateSaleStage(
    externalRequestId: string,
    input: { stage: string; documentId?: string; documentName?: string; documentMimeType?: string; note?: string },
  ) {
    return this.request(
      `/integrations/luxus-parceiros/demandas/${encodeURIComponent(externalRequestId)}/etapa-venda`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  }

  async downloadTaskAttachment(externalRequestId: string, attachmentId: string) {
    if (!this.isConfigured()) throw new ServiceUnavailableException('Integração com o Luxus Task ainda não foi configurada');
    const response = await fetch(
      `${this.apiUrl}/integrations/luxus-parceiros/demandas/${encodeURIComponent(externalRequestId)}/anexos/${encodeURIComponent(attachmentId)}`,
      { headers: { 'x-integration-key': this.integrationKey! } },
    );
    if (!response.ok) throw new BadGatewayException(`Não foi possível baixar o contrato no Luxus Task (HTTP ${response.status})`);
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get('content-type') || 'application/octet-stream',
      name: decodeURIComponent(response.headers.get('x-file-name') || 'contrato'),
    };
  }

  async getSaleDocument(saleId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, saleId },
      select: { name: true, url: true, mimeType: true, size: true },
    });
    if (!document) throw new BadGatewayException('Documento da venda não encontrado');
    const relative = document.url.includes('/uploads/')
      ? document.url.slice(document.url.indexOf('/uploads/') + '/uploads/'.length)
      : document.url.startsWith('uploads/')
        ? document.url.slice('uploads/'.length)
        : document.url.startsWith('/uploads/')
          ? basename(document.url)
          : null;
    if (!relative) {
      throw new BadGatewayException('Documento sem arquivo local disponível para o Luxus Task');
    }
    const uploadDir = this.config.get<string>('UPLOAD_DIR')
      || this.config.get<string>('RAILWAY_VOLUME_MOUNT_PATH')
      || './uploads';
    const path = join(uploadDir, basename(relative));
    if (!existsSync(path)) throw new BadGatewayException(`Arquivo físico da venda não encontrado: ${basename(relative)}`);
    const buffer = readFileSync(path);
    if (!buffer.length) throw new BadGatewayException('Arquivo físico da venda está vazio');
    return {
      name: document.name,
      mimeType: document.mimeType || 'application/octet-stream',
      size: buffer.length,
      buffer,
    };
  }

  async listSaleDocumentsForIntegration(saleId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        saleId,
        OR: [
          { url: { startsWith: '/uploads/' } },
          { url: { contains: '/uploads/' } },
          { url: { startsWith: 'uploads/' } },
        ],
      },
      select: { id: true, name: true, type: true, mimeType: true, size: true, url: true },
      orderBy: { createdAt: 'asc' },
    });
    return documents.map((document) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      mimeType: document.mimeType,
      size: document.size,
    }));
  }

  async applyCallback(dto: TaskDemandCallbackDto) {
    const existing = await this.prisma.request.findUnique({
      where: { id: dto.externalRequestId },
      select: {
        id: true,
        protocol: true,
        partnerId: true,
        createdById: true,
        createdBy: { select: { partnerId: true } },
        taskDemandId: true,
        status: true,
        resolution: true,
      },
    });
    if (!existing) return this.applySaleCallback(dto);
    if (existing.taskDemandId && existing.taskDemandId !== dto.demandId) {
      throw new BadGatewayException('A demanda não corresponde à solicitação informada');
    }

    const status = this.mapTaskStatus(dto.status);
    const resolution =
      dto.resolution?.trim() ||
      dto.observations?.filter(Boolean).at(-1)?.trim() ||
      undefined;
    const resolutionChanged = Boolean(
      resolution && resolution !== existing.resolution,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: existing.id },
        data: {
          taskDemandId: dto.demandId,
          taskProtocol: dto.protocol,
          taskStatus: dto.status,
          taskResponsibleId: dto.responsibleId,
          taskResponsibleName: dto.responsibleName,
          taskSyncError: null,
          taskSyncState: 'SYNCED',
          taskLastSyncAt: dto.updatedAt ? new Date(dto.updatedAt) : new Date(),
          status,
          ...(resolution && { resolution }),
          ...(status === 'COMPLETED' && { completedAt: new Date() }),
          ...(existing.status === 'COMPLETED' && status !== 'COMPLETED'
            ? { completedAt: null }
            : {}),
        },
      });
      if (status !== existing.status || resolutionChanged) {
        await tx.requestTimeline.create({
          data: {
            requestId: existing.id,
            action: status !== existing.status
              ? 'Status sincronizado pelo Luxus Task'
              : 'Resposta sincronizada pelo Luxus Task',
            fromStatus: existing.status,
            toStatus: status,
            details: resolution,
          },
        });
      }
    });
    if (status !== existing.status || resolutionChanged) {
      const statusLabels: Record<string, string> = {
        OPEN: 'aberta',
        IN_ANALYSIS: 'em análise',
        IN_PROGRESS: 'em andamento',
        COMPLETED: 'concluída',
        REJECTED: 'rejeitada',
      };
      const notification = {
        type: 'REQUEST' as const,
        title: status !== existing.status
          ? 'Atualização do Luxus Task'
          : 'Nova resposta do Luxus Task',
        message: status !== existing.status
          ? `A solicitação ${existing.protocol} agora está ${statusLabels[status] ?? 'atualizada'}.`
          : `A solicitação ${existing.protocol} recebeu uma nova resposta.`,
        data: { requestId: existing.id },
      };
      await this.notifications.createForPartnerUsers(
        existing.partnerId,
        notification,
      );
      if (!existing.createdBy.partnerId) {
        await this.notifications.create({
          userId: existing.createdById,
          ...notification,
        });
      }
    }
    return { accepted: true };
  }

  private async applySaleCallback(dto: TaskDemandCallbackDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: dto.externalRequestId },
      select: {
        id: true, protocol: true, partnerId: true, createdById: true,
        createdBy: { select: { partnerId: true } }, taskDemandId: true,
        taskStatus: true, contractStage: true, status: true,
        taskIsBeingEdited: true, taskEditorName: true,
        taskEditorActivity: true, taskEditorLastSeenAt: true, taskLastMessage: true,
      },
    });
    if (!sale) return { accepted: true };
    if (sale.taskDemandId && sale.taskDemandId !== dto.demandId) {
      throw new BadGatewayException('A demanda não corresponde à venda informada');
    }
    const resolution = dto.resolution?.trim()
      || dto.observations?.filter(Boolean).at(-1)?.trim()
      || undefined;
    const callbackStage = this.resolveSaleContractStage(dto, sale.contractStage);
    const workflowChanged = sale.taskStatus !== dto.status
      || callbackStage !== sale.contractStage
      || sale.taskLastMessage !== (resolution ?? null);
    for (const attachment of dto.attachments ?? []) {
      if (!attachment.id || !attachment.name) continue;
      const externalId = `task:${dto.demandId}:${attachment.id}`;
      const meta = this.resolveIncomingAttachmentMeta(attachment.name, callbackStage);
      await this.prisma.document.upsert({
        where: { externalId },
        create: {
          saleId: sale.id,
          externalId,
          name: attachment.name,
          type: meta.type,
          purpose: meta.purpose,
          url: `/task-integration/sales/${sale.id}/attachments/${attachment.id}`,
          mimeType: attachment.mimeType || 'application/octet-stream',
          size: attachment.size || 0,
        },
        update: {
          name: attachment.name,
          type: meta.type,
          purpose: meta.purpose,
          mimeType: attachment.mimeType || 'application/octet-stream',
          size: attachment.size || 0,
        },
      });
    }
    const isAwaitingFinalAdmin = callbackStage === SaleContractStage.TASK_APPROVED_REVIEW_PENDING;
    const isRejectedByTask = callbackStage === SaleContractStage.TASK_REJECTED_REVIEW_PENDING;
    await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        taskDemandId: dto.demandId,
        taskProtocol: dto.protocol,
        taskStatus: dto.status,
        taskResponsibleId: dto.responsibleId,
        taskResponsibleName: dto.responsibleName,
        taskSyncError: null,
        taskSyncStatus: 'SYNCED',
        taskLastSyncAt: dto.updatedAt ? new Date(dto.updatedAt) : new Date(),
        taskIsBeingEdited: Boolean(dto.isBeingEdited),
        taskEditorName: dto.editorName || null,
        taskEditorActivity: dto.editorActivity || null,
        taskEditorLastSeenAt: dto.editorLastSeenAt ? new Date(dto.editorLastSeenAt) : null,
        taskLastMessage: resolution || null,
        contractStage: callbackStage,
        contractStageUpdatedAt: callbackStage !== sale.contractStage ? new Date() : undefined,
        ...(workflowChanged ? { timeline: { create: {
          action: callbackStage !== sale.contractStage
            ? `Chegou do Luxus Task — vez de ${
                callbackStage === SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN
                  || callbackStage === SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN
                  || callbackStage === SaleContractStage.TASK_APPROVED_REVIEW_PENDING
                  || callbackStage === SaleContractStage.TASK_REJECTED_REVIEW_PENDING
                  ? 'Luxus Parceiros'
                  : callbackStage === SaleContractStage.AWAITING_PARTNER_SIGNATURE
                    || callbackStage === SaleContractStage.CHANGES_REQUESTED
                    ? 'Parceiro'
                    : 'Luxus Task'
              }`
            : (dto.attachments?.length
              ? `Anexos recebidos do Luxus Task (${dto.attachments.length})`
              : 'Atualização recebida do Luxus Task'),
          details: [
            `Status Task: ${dto.status}`,
            `Etapa do contrato: ${callbackStage}`,
            dto.attachments?.length ? `Anexos: ${dto.attachments.map((item) => item.name).join(', ')}` : '',
            resolution ? `Retorno: ${resolution}` : '',
          ].filter(Boolean).join('\n'),
        } } } : {}),
      },
    });
    if (workflowChanged) {
      const notification = {
        type: 'SYSTEM' as const,
        title: isAwaitingFinalAdmin
          ? 'Contrato aprovado no Luxus Task'
          : isRejectedByTask
            ? 'Contrato recusado no Luxus Task'
          : callbackStage === SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN
            ? 'Contrato em branco recebido'
            : callbackStage === SaleContractStage.TASK_VALIDATING_SIGNED_CONTRACT
              ? 'Contrato assinado enviado para conferência no Luxus Task'
            : 'Venda atualizada no Luxus Task',
        message: `${sale.protocol}: ${resolution || `status ${dto.status}`}`,
        data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
      };
      await this.notifications.createForAdminUsers(notification);
      // Quem abriu a venda e o time do parceiro também precisam acompanhar cada etapa.
      await this.notifications.create({
        userId: sale.createdById,
        ...notification,
      }).catch(() => undefined);
      if (sale.partnerId) {
        await this.notifications.createForPartnerUsers(
          sale.partnerId,
          notification,
          [sale.createdById],
        ).catch(() => undefined);
      }
    }
    return { accepted: true };
  }

  private resolveSaleContractStage(dto: TaskDemandCallbackDto, current: SaleContractStage): SaleContractStage {
    const explicit = dto.workflowStage as SaleContractStage | undefined;
    if (explicit && Object.values(SaleContractStage).includes(explicit)) return explicit;
    if (dto.status !== 'concluido' && dto.status !== 'cancelado') return current;
    if (dto.status === 'cancelado') return SaleContractStage.TASK_REJECTED_REVIEW_PENDING;
    return current === SaleContractStage.TASK_VALIDATING_SIGNED_CONTRACT
      ? SaleContractStage.TASK_APPROVED_REVIEW_PENDING
      : SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN;
  }

  private resolveIncomingAttachmentMeta(
    name: string,
    stage: SaleContractStage,
  ): { type: 'CONTRACT' | 'OTHER'; purpose: 'BLANK_CONTRACT' | 'SIGNED_CONTRACT' | 'GENERAL' } {
    const normalized = name.toLowerCase();
    if (normalized.includes('contrato assinado') || (normalized.includes('assinado') && normalized.includes('contrato'))) {
      return { type: 'CONTRACT', purpose: 'SIGNED_CONTRACT' };
    }
    if (
      normalized.includes('contrato em branco')
      || stage === SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN
      || (normalized.includes('contrato') && !normalized.includes('assinado'))
    ) {
      return { type: 'CONTRACT', purpose: 'BLANK_CONTRACT' };
    }
    return { type: 'OTHER', purpose: 'GENERAL' };
  }

  async importSaleDocumentsToTask(
    externalRequestId: string,
    documents: Array<{ id: string; name: string; type: string; mimeType: string; size: number }>,
  ) {
    if (!documents.length) return { imported: 0 };
    return this.request<{ imported: number }>(
      `/integrations/luxus-parceiros/demandas/${encodeURIComponent(externalRequestId)}/anexos`,
      { method: 'POST', body: JSON.stringify({ documents }) },
      60_000,
    );
  }

  async pushSaleDocumentIfSynced(saleId: string, document: {
    id: string;
    name: string;
    type: string;
    mimeType: string;
    size: number;
    url: string;
    purpose?: string | null;
  }) {
    if (!this.isConfigured()) return;
    if (!document.url.startsWith('/uploads/')) return;
    if (document.purpose === 'BLANK_CONTRACT' || document.purpose === 'SIGNED_CONTRACT') return;
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      select: { taskDemandId: true },
    });
    if (!sale?.taskDemandId) return;
    try {
      await this.importSaleDocumentsToTask(saleId, [{
        id: document.id,
        name: document.name,
        type: document.type,
        mimeType: document.mimeType,
        size: document.size,
      }]);
    } catch (error) {
      // Não bloqueia o upload local; a sincronização pode ser retentada no refresh.
      console.warn('[task-integration] Falha ao enviar anexo ao Luxus Task', error);
    }
  }

  private mapTaskStatus(status: string) {
    const values = {
      em_aberto: 'OPEN',
      em_andamento: 'IN_PROGRESS',
      concluido: 'COMPLETED',
      standby: 'IN_ANALYSIS',
      cancelado: 'REJECTED',
    } as const;
    return values[status as keyof typeof values] ?? 'IN_ANALYSIS';
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Integração com o Luxus Task ainda não foi configurada',
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.apiUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-integration-key': this.integrationKey!,
          ...init?.headers,
        },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new BadGatewayException(
          body?.message || `Luxus Task respondeu com HTTP ${response.status}`,
        );
      }
      return body as T;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BadGatewayException(
          'O Luxus Task demorou para responder. A demanda pode já ter sido criada; tente sincronizar novamente para confirmar sem duplicar.',
        );
      }
      throw new BadGatewayException(
        error instanceof Error
          ? `Não foi possível acessar o Luxus Task: ${error.message}`
          : 'Não foi possível acessar o Luxus Task',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private get apiUrl(): string | undefined {
    return this.config.get<string>('LUXUS_TASK_API_URL')?.trim().replace(/\/+$/, '');
  }

  private get integrationKey(): string | undefined {
    return this.config.get<string>('LUXUS_TASK_INTEGRATION_KEY')?.trim();
  }

  private get timeoutMs(): number {
    const configured = Number(this.config.get<string>('LUXUS_TASK_TIMEOUT_MS'));
    return Number.isFinite(configured) && configured >= 15_000
      ? Math.min(configured, 120_000)
      : 90_000;
  }
}
