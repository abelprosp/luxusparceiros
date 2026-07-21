import { Injectable, NotFoundException } from '@nestjs/common';
import { CommissionType, Prisma } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { resolvePartnerId } from '@/common/utils/partner-scope';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

const planInclude = {
  operator: { select: { id: true, name: true } },
  partnerPlans: {
    where: { isActive: true },
    include: { partner: { select: { id: true, name: true } } },
  },
} as const;

@Injectable()
export class PlansService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private normalizePlanData(dto: CreatePlanDto | UpdatePlanDto) {
    const { partnerId: _partnerId, ...rest } = dto;
    const commissionType = rest.commissionType ?? CommissionType.PERCENTAGE;
    const commissionValue = rest.commissionValue ?? rest.commission ?? 0;
    const commission =
      commissionType === CommissionType.PERCENTAGE
        ? commissionValue
        : rest.commission ?? 0;

    return {
      ...rest,
      commissionType,
      commissionValue,
      commission,
    };
  }

  async findAll(
    user: AuthUser,
    params: { page: number; limit: number; search?: string; operatorId?: string; partnerId?: string },
  ) {
    const where: Prisma.PlanWhereInput = { status: true };
    if (params.operatorId) where.operatorId = params.operatorId;
    if (params.search) where.name = { contains: params.search, mode: 'insensitive' };

    const partnerId = resolvePartnerId(user, params.partnerId);
    if (partnerId) {
      await this.ensurePartnerPlanLinks(partnerId);
      where.partnerPlans = { some: { partnerId, isActive: true } };
    }

    const [data, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { name: 'asc' },
        include: planInclude,
      }),
      this.prisma.plan.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string, user?: AuthUser) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: planInclude,
    });
    if (!plan) throw new NotFoundException(MESSAGES.NOT_FOUND);
    if (user?.partnerId) {
      const linked = plan.partnerPlans.some(
        (partnerPlan) => partnerPlan.partner.id === user.partnerId,
      );
      if (!linked) throw new NotFoundException(MESSAGES.NOT_FOUND);
    }
    return plan;
  }

  async create(dto: CreatePlanDto, actorId?: string) {
    const { partnerId } = dto;
    const data = this.normalizePlanData(dto);
    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.plan.create({
        data: data as Prisma.PlanCreateInput,
        include: planInclude,
      });

      if (partnerId) {
        await tx.partnerPlan.create({
          data: { partnerId, planId: created.id, isActive: true },
        });
      } else {
        await this.linkPlanToActivePartners(created.id, tx);
      }

      return tx.plan.findUnique({
        where: { id: created.id },
        include: planInclude,
      });
    });

    await this.auditService.log({
      userId: actorId,
      action: 'CREATE',
      module: 'plans',
      entityId: plan!.id,
      entityType: 'Plan',
      newData: { partnerId: partnerId ?? 'all' } as Prisma.InputJsonValue,
    });
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto, actorId?: string) {
    await this.findOne(id);
    const partnerId = 'partnerId' in dto ? dto.partnerId : undefined;
    const data = this.normalizePlanData(dto);

    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id },
        data: data as Prisma.PlanUpdateInput,
      });

      if (partnerId !== undefined) {
        await tx.partnerPlan.deleteMany({ where: { planId: id } });
        if (partnerId) {
          await tx.partnerPlan.create({
            data: { partnerId, planId: id, isActive: true },
          });
        } else {
          await this.linkPlanToActivePartners(id, tx);
        }
      }

      return tx.plan.findUnique({
        where: { id },
        include: planInclude,
      });
    });

    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE',
      module: 'plans',
      entityId: id,
      entityType: 'Plan',
    });
    return plan;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.plan.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DELETE',
      module: 'plans',
      entityId: id,
      entityType: 'Plan',
    });
    return { message: 'Plano removido com sucesso' };
  }

  private async linkPlanToActivePartners(
    planId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const partners = await tx.partner.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    if (!partners.length) return;
    await tx.partnerPlan.createMany({
      data: partners.map((partner) => ({
        partnerId: partner.id,
        planId,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }

  async ensurePartnerPlanLinks(partnerId: string) {
    const linkedCount = await this.prisma.partnerPlan.count({
      where: { partnerId, isActive: true },
    });
    if (linkedCount > 0) return;

    const activePartners = await this.prisma.partner.count({
      where: { status: 'ACTIVE' },
    });

    const plans = await this.prisma.plan.findMany({
      where: { status: true },
      select: {
        id: true,
        _count: { select: { partnerPlans: { where: { isActive: true } } } },
      },
    });
    if (!plans.length) return;

    const globalPlans = plans.filter((plan) => {
      const links = plan._count.partnerPlans;
      return links === 0 || links > 1 || (links === 1 && activePartners === 1);
    });
    if (!globalPlans.length) return;

    await this.prisma.partnerPlan.createMany({
      data: globalPlans.map((plan) => ({
        partnerId,
        planId: plan.id,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }
}
