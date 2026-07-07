import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionType, SaleStatus, Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { generateProtocol, calculatePlanCommission } from '@luxus/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { CommissionsService } from '@/modules/commissions/commissions.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { PlansService } from '@/modules/plans/plans.service';
import { EventsGateway } from '@/gateway/events.gateway';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import { assertBranchBelongsToPartner } from '@/common/utils/branch-scope';
import {
  ContestSaleDto,
  CreateSaleDto,
  RejectSaleDto,
  RequestSaleDocumentsDto,
  UpdateSaleDto,
  UpdateSaleStatusDto,
} from './dto/sale.dto';
import { DEFAULT_SALE_REQUIRED_DOCUMENTS } from './sale-documents.constants';

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
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private commissionsService: CommissionsService,
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
    private plansService: PlansService,
  ) {}

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
    },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.SaleWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (params.branchId) where.branchId = params.branchId;
    if (params.campaignId) where.campaignId = params.campaignId;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { protocol: { contains: params.search, mode: 'insensitive' } },
        { client: { name: { contains: params.search, mode: 'insensitive' } } },
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
      },
    });
    if (!sale) throw new NotFoundException(MESSAGES.NOT_FOUND);
    assertPartnerAccess(user, sale.partnerId);
    return sale;
  }

  async create(dto: CreateSaleDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);
    if (!partnerId) throw new ForbiddenException('Parceiro é obrigatório');

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
          branchId: dto.branchId,
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

    if (dto.branchId) {
      await assertBranchBelongsToPartner(this.prisma, dto.branchId, partnerId);
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new BadRequestException('Plano inválido');

    if (user.role === UserRole.PARTNER) {
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
        branchId: dto.branchId,
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
        newNumber: dto.newNumber,
        notes: dto.notes,
        requiredDocuments: DEFAULT_SALE_REQUIRED_DOCUMENTS as Prisma.InputJsonValue,
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
    const editableStatuses: SaleStatus[] = [
      SaleStatus.IN_ANALYSIS,
      SaleStatus.PENDING,
      SaleStatus.DOCUMENTS_PENDING,
      SaleStatus.CONTESTED,
    ];
    if (!editableStatuses.includes(existing.status)) {
      throw new BadRequestException('Venda não pode ser editada neste status');
    }

    const {
      client: _client,
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
      newNumber,
      chipIccid,
      contractFormat,
      notes,
    } = dto;

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
        ...(isPortability !== undefined && { isPortability }),
        ...(isVirginChip !== undefined && { isVirginChip }),
        ...(portabilityNumber !== undefined && { portabilityNumber }),
        ...(newNumber !== undefined && { newNumber }),
        ...(chipIccid !== undefined && { chipIccid }),
        ...(contractFormat !== undefined && { contractFormat }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        client: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'sales',
      entityId: id,
      entityType: 'Sale',
    });

    return sale;
  }

  async updateStatus(id: string, dto: UpdateSaleStatusDto, user: AuthUser) {
    const sale = await this.findOne(id, user);
    const allowed = STATUS_TRANSITIONS[sale.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(MESSAGES.SALE_STATUS_INVALID);
    }

    if (!isAdminRole(user.role) && dto.status === SaleStatus.APPROVED) {
      throw new ForbiddenException('Apenas administradores podem aprovar vendas');
    }

    const data: Prisma.SaleUpdateInput = { status: dto.status };
    if (dto.status === SaleStatus.APPROVED) data.approvedAt = new Date();
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

    if (dto.status === SaleStatus.APPROVED) {
      await this.commissionsService.createFromSale(updated, user.id);
    }

    await this.auditService.log({
      userId: user.id,
      action:
        dto.status === SaleStatus.APPROVED
          ? 'APPROVE'
          : dto.status === SaleStatus.REJECTED
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
    return this.updateStatus(id, { status: SaleStatus.APPROVED }, user);
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
    const documents = dto.documents.map((d) => ({
      type: d.type,
      label: d.label,
      fulfilled: d.fulfilled ?? false,
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

    const updated = await this.updateStatus(id, { status: SaleStatus.IN_ANALYSIS }, user);

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
    await this.prisma.sale.delete({ where: { id } });
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'sales',
      entityId: id,
      entityType: 'Sale',
    });
    return { message: 'Venda removida com sucesso' };
  }
}
