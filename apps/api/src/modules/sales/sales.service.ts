import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  CommissionType,
  SaleReviewStatus,
  SaleStatus,
  SaleTaskSyncStatus,
  SaleContractStage,
  DocumentPurpose,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { generateProtocol, calculatePlanCommission } from '@luxus/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { CommissionsService } from '@/modules/commissions/commissions.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { PlansService } from '@/modules/plans/plans.service';
import { EventsGateway } from '@/gateway/events.gateway';
import { TaskIntegrationService } from '@/modules/task-integration/task-integration.service';
import { UploadsService } from '@/modules/uploads/uploads.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import { assertBranchBelongsToPartner, resolveBranchId } from '@/common/utils/branch-scope';
import {
  ContestSaleDto,
  ApproveSaleForTaskDto,
  CreateSaleDto,
  RejectSaleDto,
  RequestSaleDocumentsDto,
  RequestSaleCorrectionDto,
  RequestContractCorrectionDto,
  UpdateSaleDto,
  UpdateSaleStatusDto,
} from './dto/sale.dto';
import { getRequiredDocumentsForSale } from './sale-documents.constants';

const STATUS_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  [SaleStatus.IN_ANALYSIS]: [
    SaleStatus.APPROVED,
    SaleStatus.REJECTED,
    SaleStatus.PENDING,
    SaleStatus.CONTESTED,
    SaleStatus.DOCUMENTS_PENDING,
  ],
  [SaleStatus.PENDING]: [
    SaleStatus.IN_ANALYSIS,
    SaleStatus.APPROVED,
    SaleStatus.REJECTED,
    SaleStatus.CONTESTED,
    SaleStatus.DOCUMENTS_PENDING,
  ],
  [SaleStatus.DOCUMENTS_PENDING]: [
    SaleStatus.IN_ANALYSIS,
    SaleStatus.APPROVED,
    SaleStatus.REJECTED,
    SaleStatus.CONTESTED,
  ],
  [SaleStatus.CONTESTED]: [
    SaleStatus.IN_ANALYSIS,
    SaleStatus.APPROVED,
    SaleStatus.REJECTED,
    SaleStatus.DOCUMENTS_PENDING,
  ],
  [SaleStatus.APPROVED]: [SaleStatus.ACTIVATED, SaleStatus.CANCELLED],
  [SaleStatus.REJECTED]: [],
  [SaleStatus.ACTIVATED]: [SaleStatus.CANCELLED],
  [SaleStatus.CANCELLED]: [],
};

@Injectable()
export class SalesService implements OnModuleInit, OnModuleDestroy {
  private taskSyncTimer?: NodeJS.Timeout;
  private taskSyncRunning = false;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private commissionsService: CommissionsService,
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
    private plansService: PlansService,
    private taskIntegration: TaskIntegrationService,
    private uploadsService: UploadsService,
  ) {}

  onModuleInit() {
    this.taskSyncTimer = setInterval(() => void this.processTaskSyncQueue(), 30_000);
    this.taskSyncTimer.unref();
    setImmediate(() => void this.processTaskSyncQueue());
  }

  onModuleDestroy() {
    if (this.taskSyncTimer) clearInterval(this.taskSyncTimer);
  }

  private async resolveCommission(partnerId: string, planId: string, saleValue: number) {
    const partnerPlan = await this.prisma.partnerPlan.findUnique({
      where: { partnerId_planId: { partnerId, planId } },
    });

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('Plano inválido');

    const commissionType = plan.commissionType ?? CommissionType.PERCENTAGE;
    let commissionValue = Number(plan.commissionValue ?? plan.commission);

    if (partnerPlan?.customCommission != null) {
      commissionValue = Number(partnerPlan.customCommission);
    }

    const amount = calculatePlanCommission(saleValue, commissionType, commissionValue);
    const commissionRate =
      commissionType === CommissionType.PERCENTAGE ? commissionValue : 0;

    return { amount, commissionRate, commissionType, commissionValue };
  }

  async findAll(
    user: AuthUser,
    params: {
      page: number;
      limit: number;
      search?: string;
      status?: SaleStatus;
      partnerId?: string;
      branchId?: string;
      campaignId?: string;
      turn?: 'luxus_task' | 'luxus_parceiros' | 'parceiro';
      syncError?: boolean;
    },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const branchId = resolveBranchId(user, params.branchId);
    const where: Prisma.SaleWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (branchId) where.branchId = branchId;
    if (params.campaignId) where.campaignId = params.campaignId;
    if (params.status) where.status = params.status;
    if (params.turn === 'luxus_task') {
      where.contractStage = { in: ['PRE_REVIEW', 'TASK_PROCESSING', 'TASK_VALIDATING_SIGNED_CONTRACT'] };
    } else if (params.turn === 'luxus_parceiros') {
      where.contractStage = {
        in: [
          'BLANK_CONTRACT_READY_FOR_ADMIN',
          'SIGNED_CONTRACT_READY_FOR_ADMIN',
          'TASK_APPROVED_REVIEW_PENDING',
          'TASK_REJECTED_REVIEW_PENDING',
        ],
      };
    } else if (params.turn === 'parceiro') {
      where.contractStage = { in: ['AWAITING_PARTNER_SIGNATURE', 'CHANGES_REQUESTED'] };
    }
    if (params.syncError) {
      where.AND = [
        ...((where.AND as Prisma.SaleWhereInput[]) || []),
        {
          OR: [
            { taskSyncError: { not: null } },
            { taskSyncStatus: 'RETRY' },
          ],
        },
      ];
    }
    if (params.search) {
      where.AND = [
        ...((where.AND as Prisma.SaleWhereInput[]) || []),
        {
          OR: [
            { protocol: { contains: params.search, mode: 'insensitive' } },
            { client: { name: { contains: params.search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          operator: { select: { id: true, name: true } },
          plan: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          campaign: { select: { id: true, title: true } },
          createdBy: { select: { id: true, name: true } },
          commission: true,
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string, user: AuthUser) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        client: true,
        operator: true,
        plan: true,
        partner: true,
        branch: true,
        campaign: true,
        line: true,
        createdBy: { select: { id: true, name: true } },
        commission: true,
        documents: true,
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!sale) throw new NotFoundException(MESSAGES.NOT_FOUND);
    assertPartnerAccess(user, sale.partnerId);
    if (user.branchId && sale.branchId !== user.branchId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }
    return sale;
  }

  async create(dto: CreateSaleDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);
    if (!partnerId) throw new ForbiddenException('Parceiro é obrigatório');
    const branchId = resolveBranchId(user, dto.branchId);

    if (!dto.clientId && !dto.client) {
      throw new BadRequestException('Informe o cliente ou os dados para cadastro');
    }

    if (dto.newNumber && dto.client?.phone) {
      const normalizedLine = dto.newNumber.replace(/\D/g, '');
      const normalizedPhone = dto.client.phone.replace(/\D/g, '');
      if (normalizedLine && normalizedLine === normalizedPhone) {
        throw new BadRequestException('Telefone de contato deve ser diferente da linha vendida');
      }
    }

    let clientId = dto.clientId;

    if (!clientId && dto.client) {
      if (dto.newNumber) {
        const normalizedLine = dto.newNumber.replace(/\D/g, '');
        const normalizedPhone = dto.client.phone.replace(/\D/g, '');
        if (normalizedLine && normalizedLine === normalizedPhone) {
          throw new BadRequestException('Telefone de contato deve ser diferente da linha vendida');
        }
      }

      const createdClient = await this.prisma.client.create({
        data: {
          name: dto.client.name,
          document: dto.client.document,
          documentType: dto.client.documentType ?? 'CPF',
          rg: dto.client.rg,
          email: dto.client.email,
          phone: dto.client.phone,
          address: dto.client.address,
          addressNumber: dto.client.addressNumber,
          complement: dto.client.complement,
          neighborhood: dto.client.neighborhood,
          city: dto.client.city,
          state: dto.client.state,
          zipCode: dto.client.zipCode,
          partnerId,
          branchId,
        },
      });
      clientId = createdClient.id;
    }

    if (!clientId) throw new BadRequestException('Cliente é obrigatório');

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.partnerId !== partnerId) {
      throw new BadRequestException('Cliente inválido para este parceiro');
    }

    if (dto.newNumber) {
      const normalizedLine = dto.newNumber.replace(/\D/g, '');
      const normalizedPhone = client.phone.replace(/\D/g, '');
      if (normalizedLine && normalizedLine === normalizedPhone) {
        throw new BadRequestException('Telefone de contato deve ser diferente da linha vendida');
      }
    }

    if (branchId) {
      await assertBranchBelongsToPartner(this.prisma, branchId, partnerId);
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new BadRequestException('Plano inválido');

    if (user.partnerId) {
      await this.plansService.ensurePartnerPlanLinks(partnerId);
      const linked = await this.prisma.partnerPlan.findFirst({
        where: { partnerId, planId: dto.planId, isActive: true },
      });
      if (!linked) {
        throw new BadRequestException('Plano não disponível para este parceiro');
      }
    }

    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({ where: { id: dto.campaignId } });
      if (!campaign) throw new BadRequestException('Campanha inválida');
    }

    const isVirginChip = dto.isVirginChip ?? false;
    if (isVirginChip && !dto.chipIccid?.trim()) {
      throw new BadRequestException('ICCID é obrigatório para venda com chip virgem');
    }
    if (dto.isPortability && (!dto.donorOperator || !dto.portabilityNumber?.trim())) {
      throw new BadRequestException(
        'Operadora doadora e número a ser portado são obrigatórios para portabilidade',
      );
    }

    let lineId = dto.lineId;
    if (!lineId && dto.newNumber) {
      const line = await this.prisma.line.findUnique({ where: { number: dto.newNumber } });
      if (line) lineId = line.id;
    }

    let simCardId: string | undefined;
    if (dto.chipIccid) {
      const simCard = await this.prisma.simCard.findUnique({ where: { iccid: dto.chipIccid } });
      if (simCard) simCardId = simCard.id;
    }

    const saleValue = dto.value ?? Number(plan.price);
    const { amount, commissionRate } = await this.resolveCommission(partnerId, dto.planId, saleValue);

    const sale = await this.prisma.sale.create({
      data: {
        protocol: generateProtocol('VND'),
        partnerId,
        branchId,
        clientId,
        operatorId: dto.operatorId,
        planId: dto.planId,
        campaignId: dto.campaignId,
        lineId,
        simCardId,
        chipIccid: dto.chipIccid,
        contractFormat: dto.contractFormat,
        createdById: user.id,
        value: saleValue,
        commissionRate,
        commissionValue: amount,
        isPortability: dto.isPortability ?? false,
        isVirginChip,
        portabilityNumber: dto.portabilityNumber,
        donorOperator: dto.donorOperator,
        newNumber: dto.newNumber,
        notes: dto.notes,
        requiredDocuments: getRequiredDocumentsForSale() as Prisma.InputJsonValue,
        reviewStatus: SaleReviewStatus.DRAFT,
        timeline: {
          create: {
            actorId: user.id,
            actorName: user.name,
            action: 'Venda criada como rascunho',
            toReviewStatus: SaleReviewStatus.DRAFT,
          },
        },
      },
      include: {
        client: { select: { id: true, name: true, phone: true, document: true, rg: true, email: true } },
        operator: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
        campaign: { select: { id: true, title: true } },
        line: { select: { id: true, number: true } },
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'sales',
      entityId: sale.id,
      entityType: 'Sale',
    });

    this.eventsGateway.emitToPartner(partnerId, 'sale:created', sale);
    return sale;
  }

  async update(id: string, dto: UpdateSaleDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    const lockedStatuses: SaleStatus[] = [
      SaleStatus.ACTIVATED,
      SaleStatus.CANCELLED,
      SaleStatus.REJECTED,
    ];
    if (lockedStatuses.includes(existing.status) || existing.contractStage === SaleContractStage.COMPLETED) {
      throw new BadRequestException('Venda concluída ou encerrada não pode ser editada');
    }
    if (
      ([SaleReviewStatus.REJECTED, SaleReviewStatus.CANCELLED] as SaleReviewStatus[]).includes(
        existing.reviewStatus,
      )
    ) {
      throw new BadRequestException('Venda encerrada não pode ser editada');
    }
    if (
      existing.status === SaleStatus.DOCUMENTS_PENDING &&
      !isAdminRole(user.role) &&
      Object.keys(dto).length > 0
    ) {
      throw new ForbiddenException(
        'Enquanto aguarda documentos, somente os arquivos solicitados podem ser alterados',
      );
    }

    const {
      client: clientChanges,
      clientId,
      partnerId: _partnerId,
      branchId,
      operatorId,
      planId,
      lineId,
      campaignId,
      value,
      isPortability,
      isVirginChip,
      portabilityNumber,
      donorOperator,
      newNumber,
      chipIccid,
      contractFormat,
      notes,
    } = dto;

    if (clientId !== undefined && clientId !== existing.clientId) {
      throw new BadRequestException('Não é permitido trocar o cliente da venda');
    }

    const effectivePhone = clientChanges?.phone ?? existing.client.phone;
    const effectiveNewNumber = newNumber ?? existing.newNumber;
    if (effectiveNewNumber && effectivePhone) {
      const normalizedLine = effectiveNewNumber.replace(/\D/g, '');
      const normalizedPhone = effectivePhone.replace(/\D/g, '');
      if (normalizedLine && normalizedLine === normalizedPhone) {
        throw new BadRequestException('Telefone de contato deve ser diferente da linha vendida');
      }
    }

    const effectiveBranchId = branchId ?? existing.branchId;
    if (effectiveBranchId) {
      await assertBranchBelongsToPartner(this.prisma, effectiveBranchId, existing.partnerId);
    }

    const effectivePlanId = planId ?? existing.planId;
    const effectiveOperatorId = operatorId ?? existing.operatorId;
    const plan = await this.prisma.plan.findUnique({ where: { id: effectivePlanId } });
    if (!plan || plan.operatorId !== effectiveOperatorId) {
      throw new BadRequestException('Plano ou operadora inválidos');
    }
    if (user.partnerId) {
      await this.plansService.ensurePartnerPlanLinks(existing.partnerId);
      const linked = await this.prisma.partnerPlan.findFirst({
        where: { partnerId: existing.partnerId, planId: effectivePlanId, isActive: true },
      });
      if (!linked) {
        throw new BadRequestException('Plano não disponível para este parceiro');
      }
    }

    const effectiveValue = value ?? Number(existing.value);
    const commission =
      planId !== undefined || value !== undefined
        ? await this.resolveCommission(existing.partnerId, effectivePlanId, effectiveValue)
        : null;

    if (clientChanges) {
      await this.prisma.client.update({
        where: { id: existing.clientId },
        data: {
          name: clientChanges.name,
          document: clientChanges.document,
          documentType: clientChanges.documentType,
          rg: clientChanges.rg,
          email: clientChanges.email,
          phone: clientChanges.phone,
          address: clientChanges.address,
          addressNumber: clientChanges.addressNumber,
          complement: clientChanges.complement,
          neighborhood: clientChanges.neighborhood,
          city: clientChanges.city,
          state: clientChanges.state,
          zipCode: clientChanges.zipCode,
        },
      });
    }

    const shouldRequeueTaskSync =
      existing.reviewStatus === SaleReviewStatus.APPROVED
      && existing.taskSyncStatus !== SaleTaskSyncStatus.SYNCED
      && (
        Boolean(existing.taskSyncError)
        || existing.taskSyncStatus === SaleTaskSyncStatus.RETRY
        || existing.taskSyncStatus === SaleTaskSyncStatus.PENDING
        || Boolean(clientChanges)
      );

    const sale = await this.prisma.sale.update({
      where: { id },
      data: {
        ...(clientId !== undefined && { clientId }),
        ...(branchId !== undefined && { branchId }),
        ...(operatorId !== undefined && { operatorId }),
        ...(planId !== undefined && { planId }),
        ...(lineId !== undefined && { lineId }),
        ...(campaignId !== undefined && { campaignId }),
        ...(value !== undefined && { value }),
        ...(commission && {
          commissionRate: commission.commissionRate,
          commissionValue: commission.amount,
        }),
        ...(isPortability !== undefined && { isPortability }),
        ...(isVirginChip !== undefined && { isVirginChip }),
        ...(portabilityNumber !== undefined && { portabilityNumber }),
        ...(donorOperator !== undefined && { donorOperator }),
        ...(newNumber !== undefined && { newNumber }),
        ...(chipIccid !== undefined && { chipIccid }),
        ...(contractFormat !== undefined && { contractFormat }),
        ...(notes !== undefined && { notes }),
        ...(clientChanges && existing.reviewStatus === SaleReviewStatus.APPROVED && {
          taskClientName: clientChanges.name ?? existing.taskClientName,
          taskClientDocument: clientChanges.document
            ? clientChanges.document.replace(/\D/g, '')
            : existing.taskClientDocument,
        }),
        ...(shouldRequeueTaskSync && {
          taskSyncStatus: SaleTaskSyncStatus.PENDING,
          taskSyncError: null,
          taskNextRetryAt: new Date(),
        }),
      },
      include: {
        client: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    await this.prisma.saleTimeline?.create({
      data: {
        saleId: id,
        actorId: user.id,
        actorName: user.name,
        action: shouldRequeueTaskSync
          ? 'Dados da venda atualizados — sync com Luxus Task reenfileirado'
          : 'Dados da venda atualizados',
        details: this.buildSaleEditDetails(existing, dto),
        changes: Object.keys(dto) as Prisma.InputJsonValue,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'sales',
      entityId: id,
      entityType: 'Sale',
    });

    if (shouldRequeueTaskSync) {
      setImmediate(() => void this.processTaskSyncQueue());
    }

    return sale;
  }

  async submitForReview(id: string, user: AuthUser) {
    const sale = await this.findOne(id, user);
    if (!([SaleReviewStatus.DRAFT, SaleReviewStatus.CHANGES_REQUESTED] as SaleReviewStatus[]).includes(sale.reviewStatus)) {
      throw new BadRequestException('Esta venda não está disponível para envio ou reenvio');
    }
    if (!sale.contractFormat) {
      throw new BadRequestException('Informe o formato do contrato: impressão ou ZapSign');
    }
    const requiredTypes = ['CHIP_PHOTO', 'CPF', 'RG'];
    const uploaded = new Set(sale.documents.map((document) => document.type));
    const missing = requiredTypes.filter((type) => !uploaded.has(type as never));
    if (missing.length) {
      throw new BadRequestException('Anexe a foto do chip, do CPF e do RG antes de enviar');
    }
    const previous = sale.reviewStatus;
    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        reviewStatus: SaleReviewStatus.AWAITING_REVIEW,
        submittedAt: new Date(),
        correctionReason: null,
        reviewRevision: previous === SaleReviewStatus.CHANGES_REQUESTED
          ? { increment: 1 }
          : undefined,
        timeline: {
          create: {
            actorId: user.id,
            actorName: user.name,
            action: previous === SaleReviewStatus.CHANGES_REQUESTED
              ? 'Venda corrigida e reenviada para análise'
              : 'Venda enviada para análise',
            fromReviewStatus: previous,
            toReviewStatus: SaleReviewStatus.AWAITING_REVIEW,
          },
        },
      },
      include: { partner: { select: { name: true } }, client: { select: { name: true } } },
    });
    await this.notificationsService.createForAdminUsers({
      type: 'SYSTEM',
      title: previous === SaleReviewStatus.CHANGES_REQUESTED ? 'Venda corrigida' : 'Nova venda para analisar',
      message: `${updated.protocol} · ${updated.partner.name} · ${updated.client.name}`,
      data: { saleId: updated.id, path: `/vendas?sale=${updated.id}` },
    });
    this.eventsGateway.emitToPartner(updated.partnerId, 'sale:updated', updated);
    return updated;
  }

  async startReview(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const sale = await this.findOne(id, user);
    if (!([SaleReviewStatus.AWAITING_REVIEW, SaleReviewStatus.UNDER_REVIEW] as SaleReviewStatus[]).includes(sale.reviewStatus)) {
      throw new BadRequestException('Esta venda não está aguardando análise');
    }
    if (sale.reviewStatus === SaleReviewStatus.UNDER_REVIEW) return sale;
    return this.prisma.sale.update({
      where: { id },
      data: {
        reviewStatus: SaleReviewStatus.UNDER_REVIEW,
        reviewStartedAt: new Date(),
        timeline: { create: {
          actorId: user.id,
          actorName: user.name,
          action: 'Análise iniciada pelo administrador',
          fromReviewStatus: sale.reviewStatus,
          toReviewStatus: SaleReviewStatus.UNDER_REVIEW,
        } },
      },
    });
  }

  async requestCorrection(id: string, dto: RequestSaleCorrectionDto, user: AuthUser) {
    this.assertAdmin(user);
    const sale = await this.findOne(id, user);
    if (!([SaleReviewStatus.AWAITING_REVIEW, SaleReviewStatus.UNDER_REVIEW] as SaleReviewStatus[]).includes(sale.reviewStatus)) {
      throw new BadRequestException('Esta venda não pode ser devolvida neste estado');
    }
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Explique ao parceiro o que precisa ser corrigido');
    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        reviewStatus: SaleReviewStatus.CHANGES_REQUESTED,
        correctionReason: reason,
        reviewedAt: new Date(),
        reviewedById: user.id,
        timeline: { create: {
          actorId: user.id,
          actorName: user.name,
          action: 'Correção solicitada ao parceiro',
          fromReviewStatus: sale.reviewStatus,
          toReviewStatus: SaleReviewStatus.CHANGES_REQUESTED,
          details: reason,
        } },
      },
    });
    await this.notificationsService.createForPartnerUsers(sale.partnerId, {
      type: 'SALE_CONTESTED',
      title: 'Venda precisa de correção',
      message: `${sale.protocol}: ${reason}`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    });
    this.eventsGateway.emitToPartner(sale.partnerId, 'sale:updated', updated);
    return updated;
  }

  async approveForTask(id: string, dto: ApproveSaleForTaskDto, user: AuthUser) {
    this.assertAdmin(user);
    if (!this.taskIntegration.isConfigured()) {
      throw new BadRequestException('Configure a integração com o Luxus Task antes de aprovar a venda');
    }
    const sale = await this.findOne(id, user);
    if (!([SaleReviewStatus.AWAITING_REVIEW, SaleReviewStatus.UNDER_REVIEW] as SaleReviewStatus[]).includes(sale.reviewStatus)) {
      throw new BadRequestException('Esta venda não está disponível para aprovação');
    }
    if (!sale.contractFormat) throw new BadRequestException('O formato do contrato não foi informado');
    if (!dto.clientId && (!dto.clientName?.trim() || !dto.clientDocument?.trim())) {
      throw new BadRequestException('Selecione um cliente do Luxus Task ou informe nome e CPF/CNPJ');
    }
    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        reviewStatus: SaleReviewStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: user.id,
        taskResponsibleId: dto.responsibleId,
        taskClientId: dto.clientId,
        taskClientName: dto.clientName?.trim(),
        taskClientDocumentType: dto.clientDocumentType,
        taskClientDocument: dto.clientDocument?.replace(/\D/g, ''),
        taskDeadline: new Date(dto.deadline),
        taskPriority: dto.priority ?? false,
        taskSyncStatus: SaleTaskSyncStatus.PENDING,
        contractStage: SaleContractStage.TASK_PROCESSING,
        contractStageUpdatedAt: new Date(),
        taskSyncError: null,
        taskNextRetryAt: new Date(),
        notes: dto.notes?.trim() ? [sale.notes, dto.notes.trim()].filter(Boolean).join('\n\n') : sale.notes,
        timeline: { create: {
          actorId: user.id,
          actorName: user.name,
          action: 'Venda aprovada para envio ao Luxus Task',
          fromReviewStatus: sale.reviewStatus,
          toReviewStatus: SaleReviewStatus.APPROVED,
          details: `Formato do contrato: ${sale.contractFormat === 'ZAPSIGN' ? 'ZapSign' : 'Impressão'}`,
        } },
      },
    });
    setImmediate(() => void this.processTaskSyncQueue());
    await this.notificationsService.createForPartnerUsers(sale.partnerId, {
      type: 'SALE_APPROVED',
      title: 'Venda aprovada pelo administrador',
      message: `${sale.protocol} foi aprovada e será encaminhada ao Luxus Task.`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    });
    return updated;
  }

  async retryTaskSync(id: string, user: AuthUser) {
    const sale = await this.findOne(id, user);
    if (sale.reviewStatus !== SaleReviewStatus.APPROVED) {
      throw new BadRequestException('A venda ainda não foi aprovada para o Luxus Task');
    }
    await this.prisma.sale.update({
      where: { id },
      data: {
        taskSyncStatus: SaleTaskSyncStatus.PENDING,
        taskSyncError: null,
        taskNextRetryAt: new Date(),
        // Garante que o CPF/nome corrigidos na venda sejam usados no reenvio.
        taskClientName: sale.taskClientName ?? sale.client.name,
        taskClientDocument: sale.taskClientDocument ?? sale.client.document?.replace(/\D/g, ''),
      },
    });
    setImmediate(() => void this.processTaskSyncQueue());
    return { queued: true };
  }

  /** Reenvia anexos locais ao Task sem recriar a demanda (idempotente no destino). */
  private async reinforceSaleAttachmentsToTask(id: string) {
    if (!this.taskIntegration.isConfigured()) return;
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      select: {
        id: true,
        protocol: true,
        taskDemandId: true,
        taskSyncStatus: true,
        documents: {
          select: {
            id: true,
            name: true,
            type: true,
            mimeType: true,
            size: true,
            url: true,
            externalId: true,
          },
        },
      },
    });
    if (!sale?.taskDemandId || sale.taskSyncStatus !== SaleTaskSyncStatus.SYNCED) return;

    const partnerDocuments = sale.documents.filter(
      (document) => !document.externalId?.startsWith('task:'),
    );
    const uploadDocuments = this.taskIntegration.buildUploadDocumentsPayload(partnerDocuments);
    if (!uploadDocuments.length) return;

    try {
      const imported = await this.taskIntegration.importSaleDocumentsToTask(sale.id, uploadDocuments);
      if ((imported?.failed?.length ?? 0) > 0) {
        console.warn(
          `[sales] Reforço de anexos incompleto para ${sale.protocol}: ${(imported?.failed ?? []).join('; ')}`,
        );
      }
    } catch (error) {
      console.warn('[sales] Falha no reforço automático de anexos ao Luxus Task', error);
    }
  }

  private buildSaleEditDetails(
    existing: {
      value: unknown;
      newNumber?: string | null;
      chipIccid?: string | null;
      notes?: string | null;
      contractFormat?: string | null;
      client?: {
        name?: string | null;
        document?: string | null;
        phone?: string | null;
        email?: string | null;
        rg?: string | null;
        address?: string | null;
        city?: string | null;
        state?: string | null;
        zipCode?: string | null;
      } | null;
    },
    dto: UpdateSaleDto,
  ): string | undefined {
    const lines: string[] = [];
    const pushChange = (label: string, before: unknown, after: unknown) => {
      const from = before == null || before === '' ? '—' : String(before);
      const to = after == null || after === '' ? '—' : String(after);
      if (from === to) return;
      lines.push(`${label}: ${from} → ${to}`);
    };

    if (dto.value !== undefined) pushChange('Valor', existing.value, dto.value);
    if (dto.newNumber !== undefined) pushChange('Linha', existing.newNumber, dto.newNumber);
    if (dto.chipIccid !== undefined) pushChange('ICCID', existing.chipIccid, dto.chipIccid);
    if (dto.contractFormat !== undefined) pushChange('Formato do contrato', existing.contractFormat, dto.contractFormat);
    if (dto.notes !== undefined) pushChange('Observações', existing.notes, dto.notes);

    if (dto.client) {
      pushChange('Cliente', existing.client?.name, dto.client.name);
      pushChange('CPF', existing.client?.document, dto.client.document);
      pushChange('Telefone', existing.client?.phone, dto.client.phone);
      pushChange('E-mail', existing.client?.email, dto.client.email);
      pushChange('RG', existing.client?.rg, dto.client.rg);
      pushChange('Endereço', existing.client?.address, dto.client.address);
      pushChange('Cidade', existing.client?.city, dto.client.city);
      pushChange('UF', existing.client?.state, dto.client.state);
      pushChange('CEP', existing.client?.zipCode, dto.client.zipCode);
    }

    return lines.length ? lines.join('\n') : undefined;
  }

  private assertAdmin(user: AuthUser) {
    if (!isAdminRole(user.role)) throw new ForbiddenException('Apenas administradores podem revisar vendas');
  }

  private retryDelayMs(attempts: number) {
    return Math.min(15 * 60_000, 30_000 * 2 ** Math.min(attempts, 5));
  }

  private async processTaskSyncQueue() {
    if (this.taskSyncRunning || !this.taskIntegration.isConfigured()) return;
    this.taskSyncRunning = true;
    try {
      await this.prisma.sale.updateMany({
        where: { taskSyncStatus: SaleTaskSyncStatus.PROCESSING, taskSyncLockedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
        data: { taskSyncStatus: SaleTaskSyncStatus.RETRY, taskSyncLockedAt: null, taskNextRetryAt: new Date() },
      });
      await this.prisma.sale.updateMany({
        where: { signedContractSyncStatus: SaleTaskSyncStatus.PROCESSING },
        data: { signedContractSyncStatus: SaleTaskSyncStatus.RETRY, signedContractNextRetryAt: new Date() },
      });
      const candidates = await this.prisma.sale.findMany({
        where: {
          taskResponsibleId: { not: null },
          taskSyncStatus: { in: [SaleTaskSyncStatus.PENDING, SaleTaskSyncStatus.RETRY] },
          OR: [{ taskNextRetryAt: null }, { taskNextRetryAt: { lte: new Date() } }],
        },
        select: { id: true },
        take: 10,
        orderBy: [{ taskNextRetryAt: 'asc' }, { createdAt: 'asc' }],
      });
      for (const candidate of candidates) await this.syncSaleToTask(candidate.id);
      const signedCandidates = await this.prisma.sale.findMany({
        where: {
          taskDemandId: { not: null },
          contractStage: SaleContractStage.TASK_VALIDATING_SIGNED_CONTRACT,
          signedContractSyncStatus: { in: [SaleTaskSyncStatus.PENDING, SaleTaskSyncStatus.RETRY] },
          OR: [{ signedContractNextRetryAt: null }, { signedContractNextRetryAt: { lte: new Date() } }],
        },
        select: { id: true },
        take: 10,
        orderBy: [{ signedContractNextRetryAt: 'asc' }, { updatedAt: 'asc' }],
      });
      for (const candidate of signedCandidates) await this.syncSignedContract(candidate.id);
    } finally {
      this.taskSyncRunning = false;
    }
  }

  private async syncSaleToTask(id: string) {
    // Permite retry mesmo com taskDemandId já preenchido (ex.: demanda criada sem anexos).
    const claimed = await this.prisma.sale.updateMany({
      where: { id, taskSyncStatus: { in: [SaleTaskSyncStatus.PENDING, SaleTaskSyncStatus.RETRY] } },
      data: { taskSyncStatus: SaleTaskSyncStatus.PROCESSING, taskSyncLockedAt: new Date() },
    });
    if (!claimed.count) return;
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        partner: { select: { name: true } }, branch: { select: { name: true } },
        client: true, operator: { select: { name: true } }, plan: { select: { name: true } },
        createdBy: { select: { name: true, email: true } }, documents: true,
      },
    });
    if (!sale?.taskResponsibleId || !sale.taskDeadline) return;
    try {
      let task;
      try { task = await this.taskIntegration.getDemand(sale.id); } catch { task = null; }
      if (!task) {
        const contract = sale.contractFormat === 'ZAPSIGN' ? 'ZapSign' : 'Impressão';
        // Cria a demanda sem anexos pesados; a importação acontece em seguida, 1 a 1.
        task = await this.taskIntegration.createDemand({
          entityType: 'sale',
          requestId: sale.id,
          responsibleId: sale.taskResponsibleId,
          clientId: sale.taskClientId ?? undefined,
          clientName: sale.taskClientName ?? sale.client.name,
          clientDocumentType: (sale.taskClientDocumentType as 'pf' | 'pj' | null) ?? undefined,
          clientDocument: sale.taskClientDocument ?? sale.client.document?.replace(/\D/g, '') ?? undefined,
          deadline: sale.taskDeadline.toISOString().slice(0, 10),
          subject: `Venda ${sale.protocol} — ${sale.partner.name}`,
          description: [
            'ORIGEM: LUXUS PARCEIROS — VENDA',
            `Formato do contrato: ${contract} (assinatura será obtida no Luxus Task)`,
            `Parceiro: ${sale.partner.name}`,
            sale.branch?.name ? `Loja: ${sale.branch.name}` : 'Loja: Matriz',
            `Cliente da venda: ${sale.client.name} — ${sale.client.document}`,
            `Operadora / Plano: ${sale.operator.name} / ${sale.plan.name}`,
            `Linha: ${sale.newNumber ?? '-'}`,
            `ICCID: ${sale.chipIccid ?? '-'}`,
            sale.isPortability ? `Portabilidade: ${sale.portabilityNumber ?? '-'} (${sale.donorOperator ?? '-'})` : '',
            sale.notes ? `Observações: ${sale.notes}` : '',
          ].filter(Boolean).join('\n'),
          localProtocol: sale.protocol,
          partnerName: sale.partner.name,
          branchName: sale.branch?.name,
          requesterName: sale.createdBy.name,
          requesterEmail: sale.createdBy.email,
          priority: sale.taskPriority,
          documents: [],
        });
      }
      // Nunca devolve ao Task um arquivo que originalmente veio dele.
      const partnerDocuments = sale.documents.filter(
        (document) => !document.externalId?.startsWith('task:'),
      );
      const uploadDocuments = this.taskIntegration.buildUploadDocumentsPayload(partnerDocuments);
      const localUploadCount = partnerDocuments.filter(
        (document) => document.url?.includes('uploads/'),
      ).length;
      if (localUploadCount > 0 && uploadDocuments.length === 0) {
        throw new Error(
          `Os ${localUploadCount} arquivo(s) da venda não foram encontrados no disco do servidor (UPLOAD_DIR).`,
        );
      }
      if (uploadDocuments.length) {
        const imported = await this.taskIntegration.importSaleDocumentsToTask(sale.id, uploadDocuments);
        const okCount = (imported?.imported ?? 0) + (imported?.skipped ?? 0);
        if (okCount < uploadDocuments.length || (imported?.failed?.length ?? 0) > 0) {
          throw new Error(
            `Falha ao importar anexos no Luxus Task: ${imported?.imported ?? 0} importados, `
            + `${imported?.skipped ?? 0} já existiam, ${uploadDocuments.length} enviados. `
            + `${(imported?.failed ?? []).join('; ')}`,
          );
        }
      }
      await this.prisma.sale.update({
        where: { id },
        data: {
          taskDemandId: task.id, taskProtocol: task.protocol, taskStatus: task.status,
          taskResponsibleId: task.responsible?.id ?? sale.taskResponsibleId,
          taskResponsibleName: task.responsible?.name,
          taskClientId: task.client?.id ?? sale.taskClientId,
          taskClientName: task.client?.name ?? sale.taskClientName,
          taskSyncStatus: SaleTaskSyncStatus.SYNCED, taskSyncError: null,
          taskSyncLockedAt: null, taskNextRetryAt: null, taskLastSyncAt: new Date(),
          timeline: { create: { action: `Venda vinculada ao Luxus Task (${task.protocol})` } },
        },
      });
      // Segunda passagem automática: cobre falhas intermitentes do Task logo após a aprovação.
      setTimeout(() => void this.reinforceSaleAttachmentsToTask(id), 20_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar';
      await this.prisma.sale.update({
        where: { id },
        data: {
          taskSyncStatus: SaleTaskSyncStatus.RETRY, taskSyncError: message,
          taskSyncAttempts: { increment: 1 }, taskSyncLockedAt: null,
          taskNextRetryAt: new Date(Date.now() + this.retryDelayMs(sale.taskSyncAttempts)),
          taskLastSyncAt: new Date(),
        },
      });
      if (!sale.taskSyncAttempts) await this.notificationsService.createForAdminUsers({
        type: 'SYSTEM', title: 'Venda aguardando sincronização com o Luxus Task',
        message: `${sale.protocol} continuará tentando automaticamente. ${message}`,
        data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
      });
    }
  }

  private async syncSignedContract(id: string) {
    const claimed = await this.prisma.sale.updateMany({
      where: {
        id,
        contractStage: SaleContractStage.TASK_VALIDATING_SIGNED_CONTRACT,
        signedContractSyncStatus: { in: [SaleTaskSyncStatus.PENDING, SaleTaskSyncStatus.RETRY] },
      },
      data: { signedContractSyncStatus: SaleTaskSyncStatus.PROCESSING },
    });
    if (!claimed.count) return;
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        documents: {
          where: { purpose: DocumentPurpose.SIGNED_CONTRACT },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const document = sale?.documents[0];
    if (!sale || !document) return;
    try {
      await this.taskIntegration.updateSaleStage(id, {
        stage: SaleContractStage.TASK_VALIDATING_SIGNED_CONTRACT,
        documentId: document.id,
        documentName: document.name,
        documentMimeType: document.mimeType,
        note: 'Contrato assinado conferido pelo administrador e enviado para validação final.',
      });
      await this.prisma.sale.update({
        where: { id },
        data: {
          signedContractSyncStatus: SaleTaskSyncStatus.SYNCED,
          signedContractSyncError: null,
          signedContractNextRetryAt: null,
          timeline: { create: { action: 'Contrato assinado enviado à mesma demanda do Luxus Task' } },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao enviar contrato assinado';
      await this.prisma.sale.update({
        where: { id },
        data: {
          signedContractSyncStatus: SaleTaskSyncStatus.RETRY,
          signedContractSyncError: message,
          signedContractSyncAttempts: { increment: 1 },
          signedContractNextRetryAt: new Date(Date.now() + this.retryDelayMs(sale.signedContractSyncAttempts)),
        },
      });
    }
  }

  async releaseBlankContract(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const sale = await this.findOne(id, user);
    if (sale.contractStage !== SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN) {
      throw new BadRequestException('O contrato em branco ainda não está aguardando liberação');
    }
    if (!sale.documents.some((document) => document.purpose === DocumentPurpose.BLANK_CONTRACT)) {
      throw new BadRequestException('O Luxus Task não enviou um arquivo de contrato em branco');
    }
    await this.taskIntegration.updateSaleStage(id, {
      stage: SaleContractStage.AWAITING_PARTNER_SIGNATURE,
      note: `Contrato em branco liberado por ${user.name}.`,
    });
    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        contractStage: SaleContractStage.AWAITING_PARTNER_SIGNATURE,
        contractStageUpdatedAt: new Date(),
        contractCorrectionReason: null,
        timeline: { create: { actorId: user.id, actorName: user.name, action: 'Contrato em branco liberado para assinatura' } },
      },
    });
    await this.notificationsService.createForPartnerUsers(sale.partnerId, {
      type: 'DOCUMENTS_REQUESTED',
      title: 'Contrato disponível para assinatura',
      message: `${sale.protocol}: baixe o contrato, colete as assinaturas e anexe o documento assinado.`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    });
    await this.notificationsService.create({
      userId: sale.createdById,
      type: 'DOCUMENTS_REQUESTED',
      title: 'Contrato disponível para assinatura',
      message: `${sale.protocol}: baixe o contrato, colete as assinaturas e anexe o documento assinado.`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    }).catch(() => undefined);
    return updated;
  }

  async setWorkflowTurn(
    id: string,
    turn: 'luxus_task' | 'luxus_parceiros' | 'parceiro',
    user: AuthUser,
  ) {
    const adminActing = isAdminRole(user.role);
    if (!adminActing && turn !== 'luxus_parceiros') {
      throw new ForbiddenException('O parceiro só pode devolver a vez ao Luxus Parceiros');
    }
    if (adminActing) {
      this.assertAdmin(user);
    }
    const sale = await this.findOne(id, user);
    if (!sale.taskDemandId && sale.taskSyncStatus !== 'SYNCED') {
      throw new BadRequestException('Esta venda ainda não está sincronizada com o Luxus Task');
    }
    const stage =
      turn === 'luxus_task'
        ? SaleContractStage.TASK_PROCESSING
        : turn === 'parceiro'
          ? SaleContractStage.AWAITING_PARTNER_SIGNATURE
          : sale.contractStage === SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN
            || sale.contractStage === SaleContractStage.TASK_APPROVED_REVIEW_PENDING
            || sale.contractStage === SaleContractStage.TASK_REJECTED_REVIEW_PENDING
            ? sale.contractStage
            : SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN;
    const label =
      turn === 'luxus_task'
        ? 'Luxus Task'
        : turn === 'parceiro'
          ? 'Parceiro'
          : 'Luxus Parceiros';
    await this.taskIntegration.updateSaleStage(id, {
      stage,
      note: `Vez alterada para ${label} por ${user.name}.`,
    }).catch(() => undefined);
    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        contractStage: stage,
        contractStageUpdatedAt: new Date(),
        timeline: {
          create: {
            actorId: user.id,
            actorName: user.name,
            action: `Vez do fluxo alterada para ${label}`,
            details: `Quem deve agir agora: ${label}`,
          },
        },
      },
    });
    const notification = {
      type: 'SYSTEM' as const,
      title: `Vez do fluxo: ${label}`,
      message: `${sale.protocol}: agora é a vez de ${label}.`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    };
    await this.notificationsService.createForAdminUsers(notification).catch(() => undefined);
    await this.notificationsService.create({
      userId: sale.createdById,
      ...notification,
    }).catch(() => undefined);
    if (sale.partnerId) {
      await this.notificationsService.createForPartnerUsers(
        sale.partnerId,
        notification,
        [sale.createdById],
      ).catch(() => undefined);
    }
    return updated;
  }

  async submitSignedContract(id: string, user: AuthUser) {
    const sale = await this.findOne(id, user);
    const adminActing = isAdminRole(user.role);
    const allowedStages = adminActing
      ? [
          SaleContractStage.BLANK_CONTRACT_READY_FOR_ADMIN,
          SaleContractStage.AWAITING_PARTNER_SIGNATURE,
          SaleContractStage.CHANGES_REQUESTED,
          SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN,
        ]
      : [SaleContractStage.AWAITING_PARTNER_SIGNATURE, SaleContractStage.CHANGES_REQUESTED];
    if (!(allowedStages as SaleContractStage[]).includes(sale.contractStage)) {
      throw new BadRequestException('Esta venda não está aguardando o contrato assinado');
    }
    const signed = sale.documents
      .filter((document) => document.purpose === DocumentPurpose.SIGNED_CONTRACT)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (!signed) throw new BadRequestException('Anexe o contrato assinado antes de enviar');

    // Admin anexa o assinado e deixa pronto para a própria conferência/aprovação.
    if (adminActing) {
      const updated = await this.prisma.sale.update({
        where: { id },
        data: {
          contractStage: SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN,
          contractStageUpdatedAt: new Date(),
          contractCorrectionReason: null,
          timeline: {
            create: {
              actorId: user.id,
              actorName: user.name,
              action: 'Contrato assinado anexado pelo administrador',
            },
          },
        },
      });
      await this.taskIntegration.updateSaleStage(id, {
        stage: SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN,
        note: `Contrato assinado anexado por ${user.name}. Aguardando aprovação do administrador.`,
      }).catch(() => undefined);
      return updated;
    }

    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        contractStage: SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN,
        contractStageUpdatedAt: new Date(),
        contractCorrectionReason: null,
        timeline: { create: { actorId: user.id, actorName: user.name, action: 'Contrato assinado enviado para conferência do administrador' } },
      },
    });
    await this.notificationsService.createForAdminUsers({
      type: 'SYSTEM',
      title: 'Contrato assinado pelo parceiro',
      message: `${sale.protocol}: o parceiro anexou o contrato assinado.`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    });
    await this.notificationsService.create({
      userId: sale.createdById,
      type: 'SYSTEM',
      title: 'Contrato assinado pelo parceiro',
      message: `${sale.protocol}: seu contrato assinado foi enviado para conferência.`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    }).catch(() => undefined);
    return updated;
  }

  async approveSignedContract(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const sale = await this.findOne(id, user);
    if (sale.contractStage !== SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN) {
      throw new BadRequestException('O contrato assinado não está aguardando conferência');
    }
    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        contractStage: SaleContractStage.TASK_VALIDATING_SIGNED_CONTRACT,
        contractStageUpdatedAt: new Date(),
        signedContractSyncStatus: SaleTaskSyncStatus.PENDING,
        signedContractSyncError: null,
        signedContractNextRetryAt: new Date(),
        timeline: { create: { actorId: user.id, actorName: user.name, action: 'Contrato assinado aprovado e enfileirado para o Luxus Task' } },
      },
    });
    await this.notificationsService.create({
      userId: sale.createdById,
      type: 'SYSTEM',
      title: 'Contrato assinado enviado para conferência no Luxus Task',
      message: `${sale.protocol}: o contrato assinado foi enviado ao Luxus Task.`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    }).catch(() => undefined);
    setImmediate(() => void this.processTaskSyncQueue());
    return updated;
  }

  async requestContractCorrection(id: string, dto: RequestContractCorrectionDto, user: AuthUser) {
    this.assertAdmin(user);
    const sale = await this.findOne(id, user);
    if (!([SaleContractStage.SIGNED_CONTRACT_READY_FOR_ADMIN, SaleContractStage.TASK_REJECTED_REVIEW_PENDING] as SaleContractStage[]).includes(sale.contractStage)) {
      throw new BadRequestException('O contrato assinado não está aguardando conferência');
    }
    const reason = dto.reason.trim();
    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        contractStage: SaleContractStage.CHANGES_REQUESTED,
        contractStageUpdatedAt: new Date(),
        contractCorrectionReason: reason,
        timeline: { create: { actorId: user.id, actorName: user.name, action: 'Correção do contrato assinado solicitada', details: reason } },
      },
    });
    await this.notificationsService.createForPartnerUsers(sale.partnerId, {
      type: 'DOCUMENTS_REQUESTED',
      title: 'Corrija o contrato assinado',
      message: `${sale.protocol}: ${reason}`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    });
    return updated;
  }

  async refreshTaskStatus(id: string, user: AuthUser) {
    const sale = await this.findOne(id, user);
    if (!sale.taskDemandId) return sale;
    const task = await this.taskIntegration.getDemand(id);
    await this.taskIntegration.applyCallback({
      externalRequestId: id,
      demandId: task.id,
      protocol: task.protocol,
      status: task.status,
      resolution: task.resolution,
      observations: task.observations,
      responsibleId: task.responsible?.id,
      responsibleName: task.responsible?.name,
      updatedAt: task.updatedAt,
      workflowStage: task.workflowStage,
      attachments: task.attachments,
      isBeingEdited: task.isBeingEdited,
      editorName: task.editorName,
      editorActivity: task.editorActivity,
      editorLastSeenAt: task.editorLastSeenAt,
    });
    return this.findOne(id, user);
  }

  async finalizeAfterTaskApproval(id: string, user: AuthUser) {
    this.assertAdmin(user);
    const sale = await this.findOne(id, user);
    if (sale.contractStage !== SaleContractStage.TASK_APPROVED_REVIEW_PENDING) {
      throw new BadRequestException('O Luxus Task ainda não aprovou o contrato assinado');
    }
    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        contractStage: SaleContractStage.COMPLETED,
        contractStageUpdatedAt: new Date(),
        status: SaleStatus.ACTIVATED,
        approvedAt: new Date(),
        activatedAt: new Date(),
        timeline: { create: {
          actorId: user.id,
          actorName: user.name,
          action: 'Venda finalizada após aprovação do contrato pelo Luxus Task',
        } },
      },
    });
    await this.taskIntegration.updateSaleStage(id, {
      stage: SaleContractStage.COMPLETED,
      note: `Venda finalizada por ${user.name} no Luxus Parceiros.`,
    }).catch((error) => {
      console.warn('[sales] Falha ao marcar a demanda como concluída no Luxus Task', error);
    });
    await this.commissionsService.createFromSale(updated, user.id);
    await this.notificationsService.createForPartnerUsers(sale.partnerId, {
      type: 'SALE_APPROVED',
      title: 'Venda concluída',
      message: `${sale.protocol}: contrato aprovado e venda concluída.`,
      data: { saleId: sale.id, path: `/vendas?sale=${sale.id}` },
    });
    return updated;
  }

  async updateStatus(id: string, dto: UpdateSaleStatusDto, user: AuthUser) {
    if (!isAdminRole(user.role)) {
      throw new ForbiddenException('Apenas administradores podem alterar o status da venda');
    }
    const sale = await this.findOne(id, user);
    if (dto.status === SaleStatus.APPROVED) {
      throw new BadRequestException('Use a aprovação para o Luxus Task e complete responsável, cliente e prazo');
    }
    const allowed = STATUS_TRANSITIONS[sale.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(MESSAGES.SALE_STATUS_INVALID);
    }
    if (dto.status === SaleStatus.ACTIVATED) {
      const requiredDocuments = (sale.requiredDocuments ?? []) as Array<{
        label: string;
        fulfilled: boolean;
      }>;
      const pendingDocuments = requiredDocuments.filter((document) => !document.fulfilled);
      if (pendingDocuments.length > 0) {
        throw new BadRequestException(
          `Documentos pendentes: ${pendingDocuments.map((document) => document.label).join(', ')}`,
        );
      }
    }

    const data: Prisma.SaleUpdateInput = { status: dto.status };
    if (dto.status === SaleStatus.ACTIVATED) data.activatedAt = new Date();
    if (dto.status === SaleStatus.CANCELLED) data.cancelledAt = new Date();
    if (dto.status === SaleStatus.REJECTED) data.rejectionReason = dto.rejectionReason;
    if (dto.status === SaleStatus.CONTESTED) data.contestReason = dto.contestReason;

    const updated = await this.prisma.sale.update({
      where: { id },
      data,
      include: { commission: true, partner: true },
    });

    await this.notifyStatusChange(updated, dto.status, dto.rejectionReason ?? dto.contestReason);

    if (dto.status === SaleStatus.ACTIVATED && !updated.commission) {
      await this.commissionsService.createFromSale(updated, user.id);
    }

    await this.auditService.log({
      userId: user.id,
      action:
        dto.status === SaleStatus.REJECTED
            ? 'REJECT'
            : 'UPDATE',
      module: 'sales',
      entityId: id,
      entityType: 'Sale',
      newData: { status: dto.status } as Prisma.InputJsonValue,
    });

    this.eventsGateway.emitToPartner(updated.partnerId, 'sale:updated', updated);
    return updated;
  }

  async approve(id: string, user: AuthUser) {
    if (!isAdminRole(user.role)) {
      throw new ForbiddenException('Apenas administradores podem aprovar vendas');
    }
    throw new BadRequestException('A aprovação direta foi substituída por Aprovar e enviar ao Luxus Task');
  }

  async reject(id: string, dto: RejectSaleDto, user: AuthUser) {
    if (!isAdminRole(user.role)) {
      throw new ForbiddenException('Apenas administradores podem rejeitar vendas');
    }
    return this.updateStatus(
      id,
      { status: SaleStatus.REJECTED, rejectionReason: dto.reason },
      user,
    );
  }

  async contest(id: string, dto: ContestSaleDto, user: AuthUser) {
    if (!isAdminRole(user.role)) {
      throw new ForbiddenException('Apenas administradores podem contestar vendas');
    }
    return this.updateStatus(
      id,
      { status: SaleStatus.CONTESTED, contestReason: dto.reason },
      user,
    );
  }

  async requestDocuments(id: string, dto: RequestSaleDocumentsDto, user: AuthUser) {
    if (!isAdminRole(user.role)) {
      throw new ForbiddenException('Apenas administradores podem solicitar documentos');
    }

    const sale = await this.findOne(id, user);
    if (!(STATUS_TRANSITIONS[sale.status] ?? []).includes(SaleStatus.DOCUMENTS_PENDING)) {
      throw new BadRequestException('Não é possível solicitar documentos neste status');
    }
    const uniqueTypes = new Set(dto.documents.map((document) => document.type));
    if (uniqueTypes.size !== dto.documents.length) {
      throw new BadRequestException('Não repita o mesmo tipo de documento');
    }
    const documents = dto.documents.map((d) => ({
      type: d.type,
      label: d.label,
      fulfilled: false,
    }));

    const updated = await this.prisma.sale.update({
      where: { id },
      data: {
        status: SaleStatus.DOCUMENTS_PENDING,
        requiredDocuments: documents as Prisma.InputJsonValue,
        notes: dto.message
          ? `${sale.notes ? sale.notes + '\n' : ''}${dto.message}`
          : sale.notes,
      },
      include: { partner: true },
    });

    await this.notificationsService.createForPartnerUsers(updated.partnerId, {
      type: 'DOCUMENTS_REQUESTED',
      title: 'Documentos solicitados',
      message: dto.message ?? `Documentos solicitados para a venda ${updated.protocol}.`,
      data: { saleId: updated.id, documents },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'sales',
      entityId: id,
      entityType: 'Sale',
      newData: { status: SaleStatus.DOCUMENTS_PENDING, documents } as Prisma.InputJsonValue,
    });

    this.eventsGateway.emitToPartner(updated.partnerId, 'sale:updated', updated);
    return updated;
  }

  async resubmitDocuments(id: string, user: AuthUser) {
    const sale = await this.findOne(id, user);

    if (sale.status !== SaleStatus.DOCUMENTS_PENDING) {
      throw new BadRequestException('Esta venda não está aguardando documentos');
    }

    const required = (sale.requiredDocuments ?? []) as Array<{
      type: string;
      label: string;
      fulfilled: boolean;
    }>;

    if (!required.length) {
      throw new BadRequestException('Nenhum documento foi solicitado para esta venda');
    }

    const pending = required.filter((doc) => !doc.fulfilled);
    if (pending.length > 0) {
      throw new BadRequestException(
        `Envie os documentos pendentes: ${pending.map((doc) => doc.label).join(', ')}`,
      );
    }

    const updated = await this.prisma.sale.update({
      where: { id },
      data: { status: SaleStatus.IN_ANALYSIS },
      include: { commission: true, partner: true },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'sales',
      entityId: id,
      entityType: 'Sale',
      newData: { status: SaleStatus.IN_ANALYSIS, documentsResubmitted: true } as Prisma.InputJsonValue,
    });
    this.eventsGateway.emitToPartner(updated.partnerId, 'sale:updated', updated);

    const admins = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPERVISOR] }, isActive: true },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        this.notificationsService.create({
          userId: admin.id,
          type: 'SYSTEM',
          title: 'Documentos reenviados',
          message: `O parceiro reenviou os documentos da venda ${sale.protocol}.`,
          data: { saleId: sale.id },
        }),
      ),
    );

    return updated;
  }

  private async notifyStatusChange(
    sale: { id: string; protocol: string; partnerId: string },
    status: SaleStatus,
    reason?: string,
  ) {
    const notifications: Record<
      string,
      { type: 'SALE_APPROVED' | 'SALE_REJECTED' | 'SALE_CONTESTED'; title: string; message: string }
    > = {
      [SaleStatus.APPROVED]: {
        type: 'SALE_APPROVED',
        title: 'Venda aprovada',
        message: `A venda ${sale.protocol} foi aprovada.`,
      },
      [SaleStatus.REJECTED]: {
        type: 'SALE_REJECTED',
        title: 'Venda rejeitada',
        message: `A venda ${sale.protocol} foi rejeitada.${reason ? ` Motivo: ${reason}` : ''}`,
      },
      [SaleStatus.CONTESTED]: {
        type: 'SALE_CONTESTED',
        title: 'Venda contestada',
        message: `A venda ${sale.protocol} foi contestada.${reason ? ` Motivo: ${reason}` : ''}`,
      },
    };

    const notification = notifications[status];
    if (notification) {
      await this.notificationsService.createForPartnerUsers(sale.partnerId, {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: { saleId: sale.id },
      });
    }
  }

  async remove(id: string, user: AuthUser) {
    const sale = await this.findOne(id, user);
    if (sale.status === SaleStatus.ACTIVATED) {
      throw new BadRequestException('Venda ativada não pode ser removida');
    }
    if (
      sale.taskDemandId
      || sale.taskSyncStatus !== SaleTaskSyncStatus.NOT_READY
    ) {
      throw new BadRequestException(
        'Venda enviada ou preparada para o Luxus Task não pode ser excluída',
      );
    }
    await this.prisma.$transaction([
      this.prisma.document.deleteMany({ where: { saleId: id } }),
      this.prisma.sale.delete({ where: { id } }),
    ]);
    this.uploadsService.removeStoredFiles(sale.documents);
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'sales',
      entityId: id,
      entityType: 'Sale',
    });
    return { message: 'Venda removida com sucesso' };
  }

  async bulkRemove(ids: string[], user: AuthUser) {
    this.assertAdmin(user);
    const sales = await this.prisma.sale.findMany({
      where: { id: { in: [...new Set(ids)] } },
      include: { documents: true, commission: true },
    });
    const deleted: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const sale of sales) {
      if (sale.commission?.status === 'PAID') {
        failed.push({ id: sale.id, reason: 'A comissão desta venda já foi paga' });
        continue;
      }
      try {
        await this.prisma.$transaction([
          this.prisma.commission.deleteMany({ where: { saleId: sale.id } }),
          this.prisma.document.deleteMany({ where: { saleId: sale.id } }),
          this.prisma.sale.delete({ where: { id: sale.id } }),
        ]);
        this.uploadsService.removeStoredFiles(sale.documents);
        deleted.push(sale.id);
        await this.auditService.log({
          userId: user.id,
          action: 'DELETE',
          module: 'sales',
          entityId: sale.id,
          entityType: 'Sale',
          oldData: { bulk: true, protocol: sale.protocol, taskDemandId: sale.taskDemandId },
        });
      } catch (error) {
        failed.push({ id: sale.id, reason: error instanceof Error ? error.message : 'Falha ao excluir' });
      }
    }
    for (const id of ids) {
      if (!sales.some((sale) => sale.id === id)) failed.push({ id, reason: 'Venda não encontrada' });
    }
    return {
      deleted,
      failed,
      warning: sales.some((sale) => sale.taskDemandId)
        ? 'As demandas já criadas no Luxus Task foram preservadas para manter a auditoria.'
        : undefined,
    };
  }
}
