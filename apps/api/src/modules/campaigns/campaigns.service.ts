import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { realizedSaleStatusFilter } from '@/common/constants/realized-sale-statuses';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(params: { page: number; limit: number; search?: string; status?: CampaignStatus }) {
    const where: Prisma.CampaignWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) where.title = { contains: params.search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { sales: true } } },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        commissionRules: true,
        _count: { select: { sales: true } },
      },
    });
    if (!campaign) throw new NotFoundException(MESSAGES.NOT_FOUND);
    return campaign;
  }

  async getMetrics(id: string) {
    const campaign = await this.findOne(id);
    const sales = await this.prisma.sale.findMany({
      where: { campaignId: id, status: realizedSaleStatusFilter() },
      select: { value: true, partnerId: true, partner: { select: { name: true } } },
    });

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.value), 0);
    const partnerMap = new Map<string, { partnerName: string; count: number; revenue: number }>();

    for (const sale of sales) {
      const existing = partnerMap.get(sale.partnerId) ?? {
        partnerName: sale.partner.name,
        count: 0,
        revenue: 0,
      };
      existing.count += 1;
      existing.revenue += Number(sale.value);
      partnerMap.set(sale.partnerId, existing);
    }

    const goal = campaign.goal ?? 0;
    const goalProgress = goal > 0 ? Math.min(100, Math.round((sales.length / goal) * 100)) : 0;

    return {
      totalSales: sales.length,
      totalRevenue,
      goalProgress,
      salesByPartner: Array.from(partnerMap.entries()).map(([partnerId, data]) => ({
        partnerId,
        ...data,
      })),
    };
  }

  async create(dto: CreateCampaignDto, actorId?: string) {
    const campaign = await this.prisma.campaign.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'CREATE',
      module: 'campaigns',
      entityId: campaign.id,
      entityType: 'Campaign',
    });
    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, actorId?: string) {
    await this.findOne(id);
    const data: Prisma.CampaignUpdateInput = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    const campaign = await this.prisma.campaign.update({ where: { id }, data });
    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE',
      module: 'campaigns',
      entityId: id,
      entityType: 'Campaign',
    });
    return campaign;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.campaign.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DELETE',
      module: 'campaigns',
      entityId: id,
      entityType: 'Campaign',
    });
    return { message: 'Campanha removida com sucesso' };
  }
}
