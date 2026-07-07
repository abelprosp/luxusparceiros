import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus, Prisma, Sale } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { calculateCommission } from '@luxus/utils';
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
    params: { page: number; limit: number; status?: CommissionStatus; partnerId?: string },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.CommissionWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (params.status) where.status = params.status;

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
    if (existing) return existing;

    const percentage = Number(sale.commissionRate);
    const value = calculateCommission(Number(sale.value), percentage);

    const commission = await this.prisma.commission.create({
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
      action: 'CREATE',
      module: 'commissions',
      entityId: commission.id,
      entityType: 'Commission',
      newData: { auto: true, saleId: sale.id } as Prisma.InputJsonValue,
    });

    this.eventsGateway.emitToPartner(sale.partnerId, 'commission:created', commission);
    return commission;
  }

  async approve(id: string, dto: ApproveCommissionDto, user: AuthUser) {
    const commission = await this.findOne(id, user);
    if (commission.status !== CommissionStatus.FORECAST) {
      throw new BadRequestException('Comissão não pode ser aprovada neste status');
    }

    const updated = await this.prisma.commission.update({
      where: { id },
      data: {
        status: CommissionStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: user.id,
        notes: dto.notes,
      },
    });

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
    const commission = await this.findOne(id, user);
    if (commission.status === CommissionStatus.PAID) {
      throw new BadRequestException(MESSAGES.COMMISSION_ALREADY_PAID);
    }
    if (commission.status !== CommissionStatus.APPROVED) {
      throw new BadRequestException('Comissão deve estar aprovada para confirmar pagamento');
    }

    const updated = await this.prisma.commission.update({
      where: { id },
      data: {
        status: CommissionStatus.PAID,
        paidAt: new Date(),
        notes: dto.notes ?? commission.notes,
      },
    });

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
    const commission = await this.findOne(id, user);
    if (commission.status === CommissionStatus.PAID) {
      throw new BadRequestException(MESSAGES.COMMISSION_ALREADY_PAID);
    }

    const updated = await this.prisma.commission.update({
      where: { id },
      data: { status: CommissionStatus.CANCELLED },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'REJECT',
      module: 'commissions',
      entityId: id,
      entityType: 'Commission',
    });

    return updated;
  }
}
