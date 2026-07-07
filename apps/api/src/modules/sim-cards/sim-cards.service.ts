import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LineStatus, Prisma } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, resolvePartnerId } from '@/common/utils/partner-scope';
import { CreateSimCardDto, TransferSimCardsDto, UpdateSimCardDto } from './dto/sim-card.dto';

@Injectable()
export class SimCardsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(
    user: AuthUser,
    params: {
      page: number;
      limit: number;
      search?: string;
      status?: LineStatus;
      partnerId?: string;
      generalOnly?: boolean;
    },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.SimCardWhereInput = {};
    if (params.generalOnly) where.partnerId = null;
    else if (partnerId) where.partnerId = partnerId;
    if (params.status) where.status = params.status;
    if (params.search) where.iccid = { contains: params.search };

    const [data, total] = await Promise.all([
      this.prisma.simCard.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          operator: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
        },
      }),
      this.prisma.simCard.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async getStockSummary(user: AuthUser, partnerId?: string) {
    const scopedPartnerId = resolvePartnerId(user, partnerId);
    const where: Prisma.SimCardWhereInput = scopedPartnerId ? { partnerId: scopedPartnerId } : {};

    const grouped = await this.prisma.simCard.groupBy({
      by: ['status', 'operatorId'],
      where,
      _count: { id: true },
    });

    const operators = await this.prisma.operator.findMany({
      select: { id: true, name: true },
    });
    const operatorMap = Object.fromEntries(operators.map((o) => [o.id, o.name]));

    return grouped.map((g) => ({
      status: g.status,
      operatorId: g.operatorId,
      operatorName: operatorMap[g.operatorId],
      count: g._count.id,
    }));
  }

  async findOne(id: string, user: AuthUser) {
    const simCard = await this.prisma.simCard.findUnique({
      where: { id },
      include: { operator: true, partner: true, line: true },
    });
    if (!simCard) throw new NotFoundException(MESSAGES.NOT_FOUND);
    if (simCard.partnerId) assertPartnerAccess(user, simCard.partnerId);
    return simCard;
  }

  async create(dto: CreateSimCardDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);
    const simCard = await this.prisma.simCard.create({
      data: { ...dto, partnerId },
      include: { operator: true, partner: true },
    });
    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'sim-cards',
      entityId: simCard.id,
      entityType: 'SimCard',
    });
    return simCard;
  }

  async update(id: string, dto: UpdateSimCardDto, user: AuthUser) {
    await this.findOne(id, user);
    const simCard = await this.prisma.simCard.update({
      where: { id },
      data: dto,
      include: { operator: true, partner: true },
    });
    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'sim-cards',
      entityId: id,
      entityType: 'SimCard',
    });
    return simCard;
  }

  async transfer(dto: TransferSimCardsDto, user: AuthUser) {
    if (!user.partnerId && !dto.partnerId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }

    const result = await this.prisma.simCard.updateMany({
      where: { id: { in: dto.simCardIds }, status: LineStatus.AVAILABLE },
      data: { partnerId: dto.partnerId },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'sim-cards',
      entityType: 'SimCard',
      newData: { transfer: dto } as unknown as Prisma.InputJsonValue,
    });

    return { transferred: result.count };
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.prisma.simCard.delete({ where: { id } });
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'sim-cards',
      entityId: id,
      entityType: 'SimCard',
    });
    return { message: 'Chip removido com sucesso' };
  }
}
