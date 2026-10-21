import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus, Prisma, Sale, SaleStatus } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { EventsGateway } from '@/gateway/events.gateway';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, resolvePartnerId } from '@/common/utils/partner-scope';
import { ApproveCommissionDto, PayCommissionDto } from './dto/commission.dto';

@Injectable()
export class CommissionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
  ) {}

  async findAll(
    user: AuthUser,
    params: {
      page: number;
      limit: number;
      search?: string;
      status?: CommissionStatus;
      partnerId?: string;
    },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.CommissionWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { sale: { protocol: { contains: params.search, mode: 'insensitive' } } },
        { partner: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.commission.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          partner: { select: { id: true, name: true } },
          sale: { select: { id: true, protocol: true, value: true } },
        },
      }),
      this.prisma.commission.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async getSummary(user: AuthUser) {
    const partnerId = resolvePartnerId(user);
    const [forecast, approved, paid] = await Promise.all([
      this.prisma.commission.aggregate({
        where: { partnerId, status: CommissionStatus.FORECAST },
        _sum: { value: true },
      }),
      this.prisma.commission.aggregate({
        where: { partnerId, status: CommissionStatus.APPROVED },
        _sum: { value: true },
      }),
      this.prisma.commission.aggregate({
        where: { partnerId, status: CommissionStatus.PAID },
        _sum: { value: true },
      }),
    ]);

    const forecastValue = Number(forecast._sum.value ?? 0);
    const approvedValue = Number(approved._sum.value ?? 0);
    const paidValue = Number(paid._sum.value ?? 0);

    return {
      forecast: forecastValue,
      approved: approvedValue,
      paid: paidValue,
      total: forecastValue + approvedValue + paidValue,
    };
  }

  async findOne(id: string, user: AuthUser) {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
      include: {
        partner: true,
        sale: { include: { client: true, plan: true, operator: true } },
      },
    });
    if (!commission) throw new NotFoundException(MESSAGES.NOT_FOUND);
    assertPartnerAccess(user, commission.partnerId);
    return commission;
  }

  async createFromSale(
    sale: Sale & { partner?: { commissionRate: Prisma.Decimal } | null },
    actorId: string,
  ) {
    const existing = await this.prisma.commission.findUnique({ where: { saleId: sale.id } });
    if (existing && existing.status !== CommissionStatus.CANCELLED) return existing;

    const percentage = Number(sale.commissionRate);
    const value = Number(sale.commissionValue);

    const commission = existing
      ? await this.prisma.commission.update({
          where: { id: existing.id },
          data: {
            partnerId: sale.partnerId,
            value,
            percentage,
            status: CommissionStatus.FORECAST,
            approvedAt: null,
            approvedBy: null,
            paidAt: null,
          },
          include: { sale: { select: { protocol: true } } },
        })
      : await this.prisma.commission.create({
          data: {
            partnerId: sale.partnerId,
            saleId: sale.id,
            value,
            percentage,
            status: CommissionStatus.FORECAST,
          },
          include: { sale: { select: { protocol: true } } },
        });

    await this.auditService.log({
      userId: actorId,
      action: existing ? 'UPDATE' : 'CREATE',
      module: 'commissions',
      entityId: commission.id,
      entityType: 'Commission',
      newData: { auto: true, saleId: sale.id, reactivated: Boolean(existing) } as Prisma.InputJsonValue,
    });

    this.eventsGateway.emitToPartner(sale.partnerId, 'commission:created', commission);
    return commission;
  }

  async approve(id: string, dto: ApproveCommissionDto, user: AuthUser) {
    this.assertCommissionManager(user);
    const commission = await this.findOne(id, user);
    if (commission.status !== CommissionStatus.FORECAST) {
      throw new BadRequestException('Comissão não pode ser aprovada neste status');
    }
    this.assertSaleActivated(commission.sale.status);

    const claimed = await this.prisma.commission.updateMany({
      where: { id, status: CommissionStatus.FORECAST, sale: { status: SaleStatus.ACTIVATED } },
      data: {
        status: CommissionStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: user.id,
        notes: dto.notes,
      },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException('A comissão foi alterada por outra operação. Atualize a tela e tente novamente.');
    }
    const updated = await this.prisma.commission.findUniqueOrThrow({ where: { id } });

    await this.auditService.log({
      userId: user.id,
      action: 'APPROVE',
      module: 'commissions',
      entityId: id,
      entityType: 'Commission',
    });

    await this.notificationsService.createForPartnerUsers(commission.partnerId, {
      type: 'COMMISSION',
      title: 'Comissão aprovada',
      message: `Sua comissão de R$ ${Number(updated.value).toFixed(2)} foi aprovada.`,
      data: { commissionId: id },
    });

    this.eventsGateway.emitToPartner(commission.partnerId, 'commission:approved', updated);
    return updated;
  }

  async pay(id: string, dto: PayCommissionDto, user: AuthUser) {
    this.assertCommissionManager(user);
    const commission = await this.findOne(id, user);
    if (commission.status === CommissionStatus.PAID) {
      throw new BadRequestException(MESSAGES.COMMISSION_ALREADY_PAID);
    }
    if (commission.status !== CommissionStatus.APPROVED) {
      throw new BadRequestException('Comissão deve estar aprovada para confirmar pagamento');
    }
    this.assertSaleActivated(commission.sale.status);

    const claimed = await this.prisma.commission.updateMany({
      where: { id, status: CommissionStatus.APPROVED, sale: { status: SaleStatus.ACTIVATED } },
      data: {
        status: CommissionStatus.PAID,
        paidAt: new Date(),
        notes: dto.notes ?? commission.notes,
      },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException('A comissão foi alterada por outra operação. Atualize a tela e tente novamente.');
    }
    const updated = await this.prisma.commission.findUniqueOrThrow({ where: { id } });

    await this.auditService.log({
      userId: user.id,
      action: 'PAY',
      module: 'commissions',
      entityId: id,
      entityType: 'Commission',
      newData: { confirmedExternally: true, notes: dto.notes } as Prisma.InputJsonValue,
    });

    await this.notificationsService.createForPartnerUsers(commission.partnerId, {
      type: 'COMMISSION',
      title: 'Pagamento confirmado',
      message: `O pagamento da comissão de R$ ${Number(updated.value).toFixed(2)} foi confirmado.`,
      data: { commissionId: id },
    });

    this.eventsGateway.emitToPartner(commission.partnerId, 'commission:paid', updated);
    return updated;
  }

  async cancel(id: string, user: AuthUser) {
    this.assertCommissionManager(user);
    const commission = await this.findOne(id, user);
    if (commission.status === CommissionStatus.PAID) {
      throw new BadRequestException(MESSAGES.COMMISSION_ALREADY_PAID);
    }

    const claimed = await this.prisma.commission.updateMany({
      where: { id, status: { not: CommissionStatus.PAID } },
      data: { status: CommissionStatus.CANCELLED },
    });
    if (claimed.count !== 1) throw new BadRequestException(MESSAGES.COMMISSION_ALREADY_PAID);
    const updated = await this.prisma.commission.findUniqueOrThrow({ where: { id } });

    await this.auditService.log({
      userId: user.id,
      action: 'REJECT',
      module: 'commissions',
      entityId: id,
      entityType: 'Commission',
    });

    return updated;
  }

  /** Aprovar, pagar e cancelar comissões é papel da equipe Luxus, nunca do próprio parceiro. */
  private assertCommissionManager(user: AuthUser) {
    if (user.partnerId) {
      throw new ForbiddenException('Somente a equipe Luxus pode aprovar, pagar ou cancelar comissões');
    }
  }

  private assertSaleActivated(status: SaleStatus) {
    if (status !== SaleStatus.ACTIVATED) {
      throw new BadRequestException('A comissão só pode avançar quando a venda estiver ativada');
    }
  }
}
