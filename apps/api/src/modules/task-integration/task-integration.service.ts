import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { SaleContractStage, SaleReviewStatus, SaleStatus, SaleTaskSyncStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { CommissionsService } from '@/modules/commissions/commissions.service';
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
    private readonly commissions: CommissionsService,
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
    return this.request<CreatedTaskDemand>(
      '/integrations/luxus-parceiros/demandas',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      120_000,
    );
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

  async updateDemandDetails(
    externalRequestId: string,
    input: {
      subject?: string;
      description?: string;
      deadline?: string;
      localProtocol?: string;
      partnerName?: string;
      branchName?: string;
      requesterName?: string;
      requesterEmail?: string;
    },
  ) {
    return this.request(
      `/integrations/luxus-parceiros/demandas/${encodeURIComponent(externalRequestId)}/detalhes`,
      { method: 'POST', body: JSON.stringify(input) },
      60_000,
    );
  }

  async updateSaleStage(
    externalRequestId: string,
    input: {
      stage: string;
      documentId?: string;
      documentName?: string;
      documentMimeType?: string;
      note?: string;
      turnRequestFrom?: string | null;
      turnRequestReason?: string | null;
      clearTurnRequest?: boolean;
    },
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
    const uploadDir = this.uploadDir();
    const candidates = [
      join(uploadDir, basename(relative)),
      join(uploadDir, relative.replace(/^\/+/, '')),
      join(process.cwd(), 'uploads', basename(relative)),
    ];
    const path = candidates.find((candidate) => existsSync(candidate));
    if (!path) throw new BadGatewayException(`Arquivo físico da venda não encontrado: ${basename(relative)}`);
    const buffer = readFileSync(path);
    if (!buffer.length) throw new BadGatewayException('Arquivo físico da venda está vazio');
    const mimeType = this.resolveDocumentMimeType(document.name, document.mimeType, path);
    return {
      name: document.name,
      mimeType,
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
      select: {
        id: true,
        name: true,
        type: true,
        mimeType: true,
        size: true,
        url: true,
        externalId: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return documents
      .filter((document) => !document.externalId?.startsWith('task:'))
      .map((document) => ({
        id: document.id,
        name: document.name,
        type: document.type,
        mimeType: document.mimeType,
        size: document.size,
      }));
  }

  async getSaleSummaryForIntegration(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        partner: { select: { name: true } },
        branch: { select: { name: true } },
        client: true,
        operator: { select: { name: true } },
        plan: { select: { name: true } },
        campaign: { select: { title: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada no Luxus Parceiros');
    }

    const formatPhone = (value?: string | null) => {
      const digits = (value ?? '').replace(/\D/g, '');
      if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      return value?.trim() || '—';
    };
    const formatDocument = (value?: string | null) => {
      const digits = (value ?? '').replace(/\D/g, '');
      if (digits.length === 11) {
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
      }
      if (digits.length === 14) {
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
      }
      return value?.trim() || '—';
    };
    const formatCurrency = (value: unknown) => {
      const amount = Number(value);
      if (!Number.isFinite(amount)) return '—';
      return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    const donorLabels: Record<string, string> = {
      VIVO: 'Vivo', TIM: 'TIM', CLARO: 'Claro', SURF: 'Surf', OTHER: 'Outras',
    };
    const contract = sale.contractFormat === 'ZAPSIGN' ? 'ZapSign' : 'Impressão';
    const address = [
      sale.client.address,
      sale.client.addressNumber,
      sale.client.complement,
      sale.client.neighborhood,
      sale.client.city,
      sale.client.state,
      sale.client.zipCode,
    ].filter(Boolean).join(', ');
    const lineNumber = formatPhone(sale.newNumber);

    const description = [
      'DADOS DA VENDA Luxus Parceiros',
      `Protocolo ${sale.protocol}`,
      `Parceiro ${sale.partner.name}`,
      `Loja ${sale.branch?.name ?? 'Matriz'}`,
      `Operadora ${sale.operator.name}`,
      `Plano ${sale.plan.name}`,
      `Valor ${formatCurrency(sale.value)}`,
      sale.commissionValue != null ? `Comissao ${formatCurrency(sale.commissionValue)}` : null,
      sale.campaign?.title ? `Campanha ${sale.campaign.title}` : null,
      `Registrada por ${sale.createdBy.name}`,
      `Formato do contrato ${contract}`,
      '',
      'LINHA CHIP',
      `Linha do chip ${lineNumber}`,
      `Chip virgem ${sale.isVirginChip ? 'Sim' : 'Nao'}`,
      sale.isVirginChip || sale.chipIccid ? `ICCID ${sale.chipIccid || 'sem ICCID'}` : null,
      `Portabilidade ${sale.isPortability ? 'Sim' : 'Nao'}`,
      sale.isPortability ? `Operadora doadora ${donorLabels[sale.donorOperator ?? ''] ?? sale.donorOperator ?? 'sem doadora'}` : null,
      sale.isPortability ? `Numero a ser portado ${formatPhone(sale.portabilityNumber)}` : null,
      '',
      'CLIENTE',
      `Nome ${sale.client.name}`,
      `CPF CNPJ ${formatDocument(sale.client.document)}`,
      sale.client.rg ? `RG ${sale.client.rg}` : null,
      sale.client.email ? `Email ${sale.client.email}` : null,
      `Telefone ${formatPhone(sale.client.phone)}`,
      `Endereco ${address || 'sem endereco'}`,
      sale.notes ? '' : null,
      sale.notes ? 'OBSERVACOES DA VENDA' : null,
      sale.notes ? sale.notes : null,
    ].filter((line) => line !== null).join('\n');

    const sanitize = (value: string) => value
      .replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ\s]/g, ' ')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const lineDigits = String(sale.newNumber || '').replace(/\D/g, '') || 'semlinha';
    return {
      id: sale.id,
      protocol: sale.protocol,
      partnerName: sale.partner.name,
      branchName: sale.branch?.name ?? null,
      lineNumber,
      subject: sanitize(`Venda ${sale.protocol} ${sale.partner.name} Linha ${lineDigits}`),
      description: sanitize(description),
      requesterName: sale.createdBy.name,
      requesterEmail: sale.createdBy.email,
    };
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
        reviewStatus: true, approvedAt: true, reviewedAt: true, reviewedById: true,
        taskIsBeingEdited: true, taskEditorName: true,
        taskEditorActivity: true, taskEditorLastSeenAt: true, taskLastMessage: true,
        turnRequestFrom: true, turnRequestReason: true,
        commissionRate: true, commissionValue: true,
      },
    });
    if (!sale) return { accepted: true };
    if (sale.taskDemandId && sale.taskDemandId !== dto.demandId) {
      throw new BadGatewayException('A demanda não corresponde à venda informada');
    }
    const resolution = dto.resolution?.trim()
      || dto.observations?.filter(Boolean).at(-1)?.trim()
      || undefined;
    const reminderMessage = dto.reminderMessage?.trim() || null;
    const saleLocked = sale.contractStage === SaleContractStage.COMPLETED
      || sale.status === SaleStatus.ACTIVATED
      || sale.status === SaleStatus.CANCELLED
      || sale.status === SaleStatus.REJECTED;
    const callbackStage = this.resolveSaleContractStage(dto, sale.contractStage);
    const nextStage = saleLocked ? sale.contractStage : callbackStage;
    const shouldComplete = !saleLocked
      && nextStage === SaleContractStage.COMPLETED;

    for (const attachment of dto.attachments ?? []) {
      if (!attachment.id || !attachment.name) continue;
      const externalId = `task:${dto.demandId}:${attachment.id}`;
      const meta = this.resolveIncomingAttachmentMeta(attachment.name, nextStage);
      let storedUrl = `/task-integration/sales/${sale.id}/attachments/${attachment.id}`;
      let storedSize = attachment.size || 0;
      let storedMime = attachment.mimeType || 'application/octet-stream';
      let materialized = false;
      try {
        const file = attachment.contentBase64
          ? {
              buffer: this.decodeAttachmentBase64(attachment.contentBase64),
              mimeType: storedMime,
              name: attachment.name,
            }
          : await this.downloadTaskAttachment(dto.externalRequestId, attachment.id);
        const uploadDir = this.uploadDir();
        if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
        const extension = extname(file.name || attachment.name) || '.bin';
        const filename = `${Date.now()}-${randomUUID()}${extension}`;
        writeFileSync(join(uploadDir, filename), file.buffer);
        storedUrl = `/uploads/${filename}`;
        storedSize = file.buffer.length;
        storedMime = file.mimeType || storedMime;
        materialized = true;
      } catch (error) {
        console.warn('[task-integration] Não foi possível materializar anexo do Task', attachment.id, error);
      }
      const cleanName = attachment.name
        .replace(/^CONTRATO EM BRANCO\s*[—\-]\s*/i, '')
        .replace(/^CONTRATO ASSINADO\s*[—\-]\s*/i, '')
        .trim() || attachment.name;
      await this.prisma.document.upsert({
        where: { externalId },
        create: {
          saleId: sale.id,
          externalId,
          name: cleanName,
          type: meta.type,
          purpose: meta.purpose,
          url: storedUrl,
          mimeType: storedMime,
          size: storedSize,
        },
        update: {
          name: cleanName,
          type: meta.type,
          purpose: meta.purpose,
          ...(materialized ? {
            url: storedUrl,
            mimeType: storedMime,
            size: storedSize,
          } : {}),
        },
      });
    }

    const finalStage = shouldComplete ? SaleContractStage.COMPLETED : nextStage;
    const stageChanged = finalStage !== sale.contractStage;
    const statusChanged = sale.taskStatus !== dto.status;
    const messageChanged = sale.taskLastMessage !== (resolution ?? null);
    const workflowChanged = statusChanged || stageChanged || messageChanged || Boolean(reminderMessage);

    await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        taskDemandId: dto.demandId,
        taskProtocol: dto.protocol,
        taskStatus: dto.status,
        taskResponsibleId: dto.responsibleId,
        taskResponsibleName: dto.responsibleName,
        taskSyncError: null,
        taskSyncStatus: SaleTaskSyncStatus.SYNCED,
        taskLastSyncAt: dto.updatedAt ? new Date(dto.updatedAt) : new Date(),
        taskIsBeingEdited: Boolean(dto.isBeingEdited),
        taskEditorName: dto.editorName || null,
        taskEditorActivity: dto.editorActivity || null,
        taskEditorLastSeenAt: dto.editorLastSeenAt ? new Date(dto.editorLastSeenAt) : null,
        taskLastMessage: reminderMessage || resolution || sale.taskLastMessage,
        contractStage: finalStage,
        contractStageUpdatedAt: stageChanged ? new Date() : undefined,
        turnRequestFrom: null,
        turnRequestReason: null,
        turnRequestAt: null,
        ...(reminderMessage ? { contractCorrectionReason: reminderMessage } : {}),
        ...(shouldComplete ? {
          status: SaleStatus.ACTIVATED,
          approvedAt: sale.approvedAt ?? new Date(),
          activatedAt: new Date(),
          reviewStatus: SaleReviewStatus.APPROVED,
          reviewedAt: sale.reviewedAt ?? new Date(),
        } : {}),
        ...(workflowChanged ? {
          timeline: {
            create: {
              action: shouldComplete
                ? 'Venda concluída pelo Luxus Task'
                : reminderMessage
                  ? 'Cobrança recebida do Luxus Task'
                  : (dto.attachments?.length
                    ? `Anexos recebidos do Luxus Task (${dto.attachments.length})`
                    : 'Atualização recebida do Luxus Task'),
              details: [
                `Status Task: ${dto.status}`,
                `Etapa: ${finalStage}`,
                dto.attachments?.length
                  ? `Anexos: ${dto.attachments.map((item) => item.name).join(', ')}`
                  : '',
                reminderMessage ? `Cobrança: ${reminderMessage}` : '',
                resolution ? `Retorno: ${resolution}` : '',
              ].filter(Boolean).join('\n'),
            },
          },
        } : {}),
      },
    });

    if (shouldComplete) {
      await this.commissions.createFromSale(
        {
          id: sale.id,
          partnerId: sale.partnerId,
          commissionRate: sale.commissionRate,
          commissionValue: sale.commissionValue,
        } as Parameters<CommissionsService['createFromSale']>[0],
        sale.createdById,
      ).catch((error) => {
        console.warn('[task-integration] Falha ao criar comissão na conclusão pelo Task', error);
      });
    }

    if (workflowChanged || shouldComplete || reminderMessage) {
      const notification = shouldComplete
        ? {
            type: 'SALE_APPROVED' as const,
            title: 'Venda concluída',
            message: `${sale.protocol}: o Luxus Task concluiu a demanda. A venda foi finalizada e os anexos estão disponíveis.`,
            data: {
              saleId: sale.id,
              path: `/vendas?sale=${sale.id}`,
              event: 'SALE_COMPLETED_BY_TASK',
            },
          }
        : reminderMessage
          ? {
              type: 'SYSTEM' as const,
              title: 'Aviso do Luxus Task',
              message: `${sale.protocol}: ${reminderMessage}`,
              data: {
                saleId: sale.id,
                path: `/vendas?sale=${sale.id}&message=1`,
                event: 'TASK_REMINDER',
                reminderMessage,
              },
            }
          : {
              type: 'SYSTEM' as const,
              title: 'Venda atualizada no Luxus Task',
              message: `${sale.protocol}: ${resolution || `status ${dto.status}`}`,
              data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
            };

      await this.notifications.createForAdminUsers(notification);
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
    if (current === SaleContractStage.COMPLETED) return current;
    const explicit = dto.workflowStage as SaleContractStage | undefined;
    // Só finaliza a venda no Parceiros quando o Task envia COMPLETED explicitamente.
    // Concluir a demanda no Task (status concluido) é independente e não fecha a venda sozinho.
    if (explicit === SaleContractStage.COMPLETED) {
      return SaleContractStage.COMPLETED;
    }
    if (dto.status === 'cancelado') {
      return SaleContractStage.TASK_PROCESSING;
    }
    // Após o envio, a demanda fica com o Task até FINALIZAR VENDA no Parceiros.
    return SaleContractStage.TASK_PROCESSING;
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
      || (normalized.includes('contrato') && !normalized.includes('assinado'))
    ) {
      // Contrato anexado pelo Task no novo fluxo = assinado / final.
      return { type: 'CONTRACT', purpose: stage === SaleContractStage.COMPLETED ? 'SIGNED_CONTRACT' : 'SIGNED_CONTRACT' };
    }
    if (stage === SaleContractStage.COMPLETED || stage === SaleContractStage.TASK_PROCESSING) {
      if (normalized.includes('contrato')) {
        return { type: 'CONTRACT', purpose: 'SIGNED_CONTRACT' };
      }
    }
    return { type: 'OTHER', purpose: 'GENERAL' };
  }

  async importSaleDocumentsToTask(
    externalRequestId: string,
    documents: Array<{
      id: string;
      name: string;
      type: string;
      mimeType: string;
      size: number;
      contentBase64?: string;
    }>,
  ) {
    if (!documents.length) return { imported: 0, skipped: 0, failed: [] as string[] };
    const failed: string[] = [];
    let imported = 0;
    let skipped = 0;
    // Um arquivo por vez evita timeout/corpo gigante e facilita diagnosticar falhas.
    for (const document of documents) {
      try {
        const result = await this.request<{
          imported: number;
          skipped?: number;
          failed?: string[];
        }>(
          `/integrations/luxus-parceiros/demandas/${encodeURIComponent(externalRequestId)}/anexos`,
          { method: 'POST', body: JSON.stringify({ documents: [document] }) },
          120_000,
        );
        imported += result?.imported ?? 0;
        skipped += result?.skipped ?? 0;
        if ((result?.failed?.length ?? 0) > 0) {
          failed.push(...(result.failed ?? []));
        } else if ((result?.imported ?? 0) + (result?.skipped ?? 0) < 1) {
          failed.push(`${document.type}:${document.name}`);
        }
      } catch (error) {
        failed.push(
          `${document.type}:${document.name} (${error instanceof Error ? error.message : 'erro'})`,
        );
      }
    }
    return { imported, skipped, failed };
  }

  buildUploadDocumentsPayload(
    documents: Array<{
      id: string;
      name: string;
      type: string;
      mimeType: string;
      size: number;
      url: string;
    }>,
  ) {
    const payload: Array<{
      id: string;
      name: string;
      type: string;
      mimeType: string;
      size: number;
      contentBase64?: string;
    }> = [];
    const missing: string[] = [];

    for (const document of documents) {
      if (!document.url?.includes('uploads/')) {
        missing.push(`${document.type}:${document.name} (URL sem uploads/)`);
        continue;
      }
      const relative = document.url.includes('/uploads/')
        ? document.url.slice(document.url.indexOf('/uploads/') + '/uploads/'.length)
        : document.url.startsWith('uploads/')
          ? document.url.slice('uploads/'.length)
          : basename(document.url);
      const candidates = [
        join(this.uploadDir(), basename(relative)),
        join(this.uploadDir(), relative.replace(/^\/+/, '')),
        join(process.cwd(), 'uploads', basename(relative)),
      ];
      const path = candidates.find((candidate) => existsSync(candidate));
      if (!path) {
        missing.push(`${document.type}:${document.name} (${basename(relative)})`);
        continue;
      }
      const buffer = readFileSync(path);
      if (!buffer.length) {
        missing.push(`${document.type}:${document.name} (vazio)`);
        continue;
      }
      payload.push({
        id: document.id,
        name: document.name,
        type: document.type,
        mimeType: this.resolveDocumentMimeType(document.name, document.mimeType, path),
        size: buffer.length,
        contentBase64: buffer.toString('base64'),
      });
    }

    if (missing.length) {
      console.error('[task-integration] Arquivos locais não encontrados para sync', missing);
    }
    return { documents: payload, missing };
  }

  private resolveDocumentMimeType(name: string, mimeType: string | null | undefined, filePath: string) {
    const fromDb = mimeType?.trim();
    if (fromDb && fromDb !== 'application/octet-stream') return fromDb;
    const ext = extname(name || filePath).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    return fromDb || 'application/octet-stream';
  }

  private uploadDir() {
    return this.config.get<string>('UPLOAD_DIR')
      || this.config.get<string>('RAILWAY_VOLUME_MOUNT_PATH')
      || './uploads';
  }

  private decodeAttachmentBase64(contentBase64: string): Buffer {
    const normalized = contentBase64.trim().replace(/\s+/g, '');
    if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
      throw new Error('Conteúdo base64 do anexo é inválido');
    }
    const buffer = Buffer.from(normalized, 'base64');
    if (!buffer.length) throw new Error('Conteúdo base64 do anexo está vazio');
    return buffer;
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
      const built = this.buildUploadDocumentsPayload([{
        id: document.id,
        name: document.name,
        type: document.type,
        mimeType: document.mimeType,
        size: document.size,
        url: document.url,
      }]);
      if (built.missing.length) {
        throw new Error(`Arquivo local ausente: ${built.missing.join('; ')}`);
      }
      if (!built.documents.length) return;
      const result = await this.importSaleDocumentsToTask(saleId, built.documents);
      if (
        (result.imported + result.skipped) < built.documents.length
        || result.failed.length > 0
      ) {
        throw new Error(result.failed.join('; ') || 'O Luxus Task não confirmou o anexo');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar anexo ao Luxus Task';
      await this.prisma.sale.update({
        where: { id: saleId },
        data: {
          taskSyncStatus: SaleTaskSyncStatus.RETRY,
          taskSyncError: message,
          taskNextRetryAt: new Date(),
        },
      }).catch(() => undefined);
      // Não bloqueia o upload local; a fila fará uma nova tentativa.
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
