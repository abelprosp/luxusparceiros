import { Injectable } from '@nestjs/common';
import {
  CommissionStatus,
  LineStatus,
  PartnerStatus,
  Prisma,
  SaleReviewStatus,
  SaleStatus,
} from '@prisma/client';
import {
  AuthUser,
  DashboardAdminMetrics,
  DashboardDetails,
  DashboardPartnerMetrics,
  UserRole,
} from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveBranchId } from '@/common/utils/branch-scope';
import { realizedSaleStatusFilter } from '@/common/constants/realized-sale-statuses';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';

/** Vendas que ainda entram na projeção de comissão do ciclo. */
const PIPELINE_SALE_STATUSES: SaleStatus[] = [
  SaleStatus.IN_ANALYSIS,
  SaleStatus.PENDING,
  SaleStatus.APPROVED,
  SaleStatus.DOCUMENTS_PENDING,
  SaleStatus.CONTESTED,
  SaleStatus.ACTIVATED,
];

const IN_PROGRESS_SALE_STATUSES: SaleStatus[] = [
  SaleStatus.IN_ANALYSIS,
  SaleStatus.PENDING,
  SaleStatus.APPROVED,
  SaleStatus.DOCUMENTS_PENDING,
  SaleStatus.CONTESTED,
];

const CANCELLED_SALE_STATUSES: SaleStatus[] = [
  SaleStatus.CANCELLED,
  SaleStatus.REJECTED,
];

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private resolvePeriod(filters: DashboardFiltersDto) {
    const now = new Date();
    const period = filters.period === 'month' ? 'month' : '30d';
    const since = period === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      now,
      period: period as '30d' | 'month',
      since,
      periodLabel: period === 'month' ? 'Mês atual' : 'Últimos 30 dias',
      chartSince: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    };
  }

  async getAdminMetrics(filters: DashboardFiltersDto = {}): Promise<DashboardAdminMetrics> {
    const { period, since, periodLabel, chartSince } = this.resolvePeriod(filters);

    const partnerWhere = this.buildPartnerWhere(filters);
    const lineWhere = this.buildLineWhere(filters);
    const saleWherePeriod = this.buildSaleWhere(filters, since);
    const commissionWhere = this.buildCommissionWhere(filters, since);
    const projectionWhere = this.buildProjectionSaleWhere(filters, since);
    const inProgressWhere = this.buildStatusSaleWhere(filters, since, IN_PROGRESS_SALE_STATUSES);
    const cancelledWhere = this.buildStatusSaleWhere(filters, since, CANCELLED_SALE_STATUSES, {
      byCancelledAt: true,
    });

    const [
      totalPartners,
      activePartners,
      availableLines,
      soldLines,
      activatedLines,
      sales,
      commissions,
      projectedSales,
      inProgressSales,
      cancelledSales,
      partnersInBrazil,
      ranking,
      salesChart,
      campaignSales,
    ] = await Promise.all([
      this.prisma.partner.count({ where: partnerWhere }),
      this.prisma.partner.count({ where: { ...partnerWhere, status: PartnerStatus.ACTIVE } }),
      this.prisma.line.count({ where: { ...lineWhere, status: LineStatus.AVAILABLE } }),
      this.prisma.line.count({
        where: {
          ...lineWhere,
          OR: [
            { status: { in: [LineStatus.USED, LineStatus.ACTIVATED] } },
            { sales: { some: { status: SaleStatus.ACTIVATED } } },
          ],
        },
      }),
      this.prisma.line.count({ where: { ...lineWhere, status: LineStatus.ACTIVATED } }),
      this.prisma.sale.findMany({
        where: saleWherePeriod,
        select: { value: true },
      }),
      this.prisma.commission.findMany({
        where: commissionWhere,
        select: { value: true },
      }),
      this.prisma.sale.findMany({
        where: projectionWhere,
        select: { commissionValue: true },
      }),
      this.prisma.sale.findMany({
        where: inProgressWhere,
        select: { value: true },
      }),
      this.prisma.sale.findMany({
        where: cancelledWhere,
        select: { value: true },
      }),
      this.prisma.partner.findMany({
        where: partnerWhere,
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          latitude: true,
          longitude: true,
          status: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.sale.groupBy({
        by: ['partnerId'],
        _count: { id: true },
        where: saleWherePeriod,
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      this.getSalesChart(chartSince, filters),
      this.prisma.sale.groupBy({
        by: ['campaignId'],
        _count: { id: true },
        _sum: { value: true },
        where: {
          ...saleWherePeriod,
          campaignId: filters.campaignId ? filters.campaignId : { not: null },
        },
      }),
    ]);

    const partnerIds = ranking.map((r) => r.partnerId);
    const partners = await this.prisma.partner.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, name: true },
    });
    const partnerMap = Object.fromEntries(partners.map((p) => [p.id, p.name]));

    const campaignIds = campaignSales
      .map((c) => c.campaignId)
      .filter((id): id is string => id != null);
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, title: true },
    });
    const campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c.title]));

    return {
      totalPartners,
      activePartners,
      availableLines,
      soldLines,
      activatedLines,
      revenue: sales.reduce((sum, s) => sum + Number(s.value), 0),
      commissions: commissions.reduce((sum, c) => sum + Number(c.value), 0),
      projectedCommission: projectedSales.reduce(
        (sum, s) => sum + Number(s.commissionValue ?? 0),
        0,
      ),
      inProgressSales: inProgressSales.length,
      inProgressValue: inProgressSales.reduce((sum, s) => sum + Number(s.value), 0),
      cancelledSales: cancelledSales.length,
      cancelledValue: cancelledSales.reduce((sum, s) => sum + Number(s.value), 0),
      period,
      periodLabel,
      salesChart,
      partnersInBrazil: partnersInBrazil.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        state: p.state,
        zipCode: p.zipCode,
        latitude: p.latitude,
        longitude: p.longitude,
        status: p.status,
      })),
      ranking: ranking.map((r) => ({
        partnerId: r.partnerId,
        partnerName: partnerMap[r.partnerId] ?? 'Desconhecido',
        sales: r._count.id,
      })),
      campaignPerformance: campaignSales
        .filter((c) => c.campaignId)
        .map((c) => ({
          campaignId: c.campaignId!,
          title: campaignMap[c.campaignId!] ?? 'Campanha',
          salesCount: c._count.id,
          revenue: Number(c._sum.value ?? 0),
        })),
    };
  }

  async getPartnerMetrics(user: AuthUser, requestedBranchId?: string): Promise<DashboardPartnerMetrics> {
    if (!user.partnerId) {
      return this.emptyPartnerMetrics();
    }

    const partnerId = user.partnerId;
    const branchId = resolveBranchId(user, requestedBranchId);
    const saleFilter: { partnerId: string; branchId?: string } = { partnerId };
    if (branchId) saleFilter.branchId = branchId;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });

    const [
      salesToday,
      salesMonth,
      activeLines,
      cancelledLines,
      forecastCommission,
      paidCommission,
      salesChart,
      monthlyChart,
      topProducts,
      topOperators,
      allPartnerSales,
    ] = await Promise.all([
      this.prisma.sale.count({
        where: { ...saleFilter, createdAt: { gte: startOfDay }, status: realizedSaleStatusFilter() },
      }),
      this.prisma.sale.count({
        where: { ...saleFilter, createdAt: { gte: startOfMonth }, status: realizedSaleStatusFilter() },
      }),
      this.prisma.line.count({
        where: {
          partnerId,
          status: LineStatus.ACTIVATED,
          ...(branchId
            ? { sales: { some: { branchId, status: realizedSaleStatusFilter() } } }
            : {}),
        },
      }),
      this.prisma.line.count({
        where: {
          partnerId,
          status: LineStatus.CANCELLED,
          ...(branchId
            ? { sales: { some: { branchId, status: realizedSaleStatusFilter() } } }
            : {}),
        },
      }),
      this.prisma.commission.aggregate({
        where: {
          partnerId,
          status: CommissionStatus.FORECAST,
          sale: { status: realizedSaleStatusFilter(), ...(branchId && { branchId }) },
        },
        _sum: { value: true },
      }),
      this.prisma.commission.aggregate({
        where: {
          partnerId,
          status: CommissionStatus.PAID,
          sale: { status: realizedSaleStatusFilter(), ...(branchId && { branchId }) },
        },
        _sum: { value: true },
      }),
      this.getSalesChart(thirtyDaysAgo, { partnerId }, branchId),
      this.getMonthlyChart(partnerId, branchId),
      this.prisma.sale.groupBy({
        by: ['planId'],
        _count: { id: true },
        where: {
          ...saleFilter,
          createdAt: { gte: startOfMonth },
          status: realizedSaleStatusFilter(),
        },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.sale.groupBy({
        by: ['operatorId'],
        _count: { id: true },
        where: {
          ...saleFilter,
          createdAt: { gte: startOfMonth },
          status: realizedSaleStatusFilter(),
        },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.sale.groupBy({
        by: ['partnerId'],
        _count: { id: true },
        where: { createdAt: { gte: startOfMonth }, status: realizedSaleStatusFilter() },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    const planIds = topProducts.map((p) => p.planId);
    const operatorIds = topOperators.map((o) => o.operatorId);
    const [plans, operators] = await Promise.all([
      this.prisma.plan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } }),
      this.prisma.operator.findMany({ where: { id: { in: operatorIds } }, select: { id: true, name: true } }),
    ]);

    const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]));
    const operatorMap = Object.fromEntries(operators.map((o) => [o.id, o.name]));

    const rankingIndex = allPartnerSales.findIndex((p) => p.partnerId === partnerId);
    const goal = partner?.goalMonth ?? 0;
    const goalProgress = goal > 0 ? Math.min(100, Math.round((salesMonth / goal) * 100)) : 0;

    return {
      salesToday,
      salesMonth,
      activeLines,
      cancelledLines,
      goal,
      goalProgress,
      forecastCommission: Number(forecastCommission._sum.value ?? 0),
      paidCommission: Number(paidCommission._sum.value ?? 0),
      ranking: rankingIndex >= 0 ? rankingIndex + 1 : 0,
      salesChart,
      monthlyChart,
      topProducts: topProducts.map((p) => ({ name: planMap[p.planId] ?? 'Plano', count: p._count.id })),
      topOperators: topOperators.map((o) => ({
        name: operatorMap[o.operatorId] ?? 'Operadora',
        count: o._count.id,
      })),
    };
  }

  async getMetrics(user: AuthUser, requestedBranchId?: string) {
    if (user.partnerId) {
      return this.getPartnerMetrics(user, requestedBranchId);
    }
    if ([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.FINANCIAL].includes(user.role)) {
      return this.getAdminMetrics();
    }
    return this.getPartnerMetrics(user, requestedBranchId);
  }

  async getDetails(
    user: AuthUser,
    filters: DashboardFiltersDto = {},
    requestedBranchId?: string,
  ): Promise<DashboardDetails> {
    const { now, since, periodLabel } = this.resolvePeriod(filters);
    // Admin pode filtrar por filial; usuário de filial fica sempre restrito à própria.
    const branchId = resolveBranchId(user, requestedBranchId);
    const scopedFilters: DashboardFiltersDto = {
      ...filters,
      ...(user.partnerId && { partnerId: user.partnerId }),
    };
    const saleWhere: Prisma.SaleWhereInput = {
      ...this.buildSaleWhere(scopedFilters, since),
      ...(branchId && { branchId }),
    };
    const inProgressWhere: Prisma.SaleWhereInput = {
      ...this.buildStatusSaleWhere(scopedFilters, since, IN_PROGRESS_SALE_STATUSES),
      ...(branchId && { branchId }),
    };
    const cancelledWhere: Prisma.SaleWhereInput = {
      ...this.buildStatusSaleWhere(scopedFilters, since, CANCELLED_SALE_STATUSES, {
        byCancelledAt: true,
      }),
      ...(branchId && { branchId }),
    };
    const partnerWhere = this.buildPartnerWhere(scopedFilters);
    const lineWhere: Prisma.LineWhereInput = {
      ...this.buildLineWhere(scopedFilters),
      ...(branchId && { sales: { some: { branchId, status: realizedSaleStatusFilter() } } }),
    };
    const commissionWhere: Prisma.CommissionWhereInput = {
      ...this.buildCommissionWhere(scopedFilters, since, branchId),
    };

    const saleSelect = {
      id: true,
      protocol: true,
      status: true,
      value: true,
      createdAt: true,
      activatedAt: true,
      cancelledAt: true,
      partner: { select: { name: true } },
      branch: { select: { name: true } },
      client: { select: { name: true } },
      plan: { select: { name: true } },
    } as const;

    const mapSaleRow = (sale: {
      id: string;
      protocol: string;
      status: string;
      value: unknown;
      createdAt: Date;
      activatedAt?: Date | null;
      cancelledAt?: Date | null;
      partner: { name: string };
      branch: { name: string } | null;
      client: { name: string };
      plan: { name: string };
    }) => ({
      id: sale.id,
      primary: sale.protocol,
      secondary: [
        sale.partner.name,
        sale.branch?.name ?? 'Matriz',
        sale.client.name,
        sale.plan.name,
      ].join(' • '),
      status: sale.status,
      value: Number(sale.value),
      date: (sale.activatedAt ?? sale.cancelledAt ?? sale.createdAt).toISOString(),
    });

    const [sales, salesInProgress, salesCancelled, partners, lines, commissions, campaigns] = await Promise.all([
      this.prisma.sale.findMany({
        where: saleWhere,
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: saleSelect,
      }),
      this.prisma.sale.findMany({
        where: inProgressWhere,
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: saleSelect,
      }),
      this.prisma.sale.findMany({
        where: cancelledWhere,
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: saleSelect,
      }),
      this.prisma.partner.findMany({
        where: partnerWhere,
        take: 1000,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, city: true, state: true, status: true, createdAt: true },
      }),
      this.prisma.line.findMany({
        where: lineWhere,
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          createdAt: true,
          operator: { select: { name: true } },
          partner: { select: { name: true } },
        },
      }),
      this.prisma.commission.findMany({
        where: commissionWhere,
        take: 1000,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          value: true,
          status: true,
          createdAt: true,
          partner: { select: { name: true } },
          sale: { select: { protocol: true } },
        },
      }),
      this.prisma.sale.groupBy({
        by: ['campaignId'],
        where: { ...saleWhere, campaignId: { not: null } },
        _count: { id: true },
        _sum: { value: true },
      }),
    ]);

    const campaignIds = campaigns
      .map((campaign) => campaign.campaignId)
      .filter((id): id is string => Boolean(id));
    const campaignNames = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, title: true },
    });
    const scopedBranch = branchId
      ? await this.prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } })
      : null;
    const campaignMap = Object.fromEntries(campaignNames.map((campaign) => [campaign.id, campaign.title]));
    const scopedPartnerName = user.partnerId ? partners[0]?.name : undefined;

    return {
      generatedAt: now.toISOString(),
      scopeLabel:
        [
          [scopedPartnerName, scopedBranch?.name].filter(Boolean).join(' • ')
            || (scopedFilters.partnerId ? 'Parceiro selecionado' : 'Visão administrativa'),
          periodLabel,
        ].filter(Boolean).join(' • '),
      sales: sales.map(mapSaleRow),
      salesInProgress: salesInProgress.map(mapSaleRow),
      salesCancelled: salesCancelled.map(mapSaleRow),
      partners: partners.map((partner) => ({
        id: partner.id,
        primary: partner.name,
        secondary: [partner.city, partner.state].filter(Boolean).join(' - ') || 'Localização não informada',
        status: partner.status,
        date: partner.createdAt.toISOString(),
      })),
      lines: lines.map((line) => ({
        id: line.id,
        primary: line.number,
        secondary: `${line.operator.name} • ${line.partner?.name ?? 'Estoque geral'}`,
        status: line.status,
        date: line.createdAt.toISOString(),
      })),
      commissions: commissions.map((commission) => ({
        id: commission.id,
        primary: commission.sale.protocol,
        secondary: commission.partner.name,
        status: commission.status,
        value: Number(commission.value),
        date: commission.createdAt.toISOString(),
      })),
      campaigns: campaigns
        .filter((campaign) => campaign.campaignId)
        .map((campaign) => ({
          id: campaign.campaignId!,
          primary: campaignMap[campaign.campaignId!] ?? 'Campanha',
          secondary: `${campaign._count.id} vendas realizadas`,
          value: Number(campaign._sum.value ?? 0),
        })),
    };
  }

  private buildSaleWhere(filters: DashboardFiltersDto, since?: Date): Prisma.SaleWhereInput {
    const where: Prisma.SaleWhereInput = {
      status: realizedSaleStatusFilter(),
    };

    if (since) {
      // Receita do mês = vendas ativadas no período (não pela data de cadastro).
      where.OR = [
        { activatedAt: { gte: since } },
        { activatedAt: null, createdAt: { gte: since } },
      ];
    }
    if (filters.partnerId) {
      where.partnerId = filters.partnerId;
    }
    if (filters.campaignId) {
      where.campaignId = filters.campaignId;
    }
    if (filters.operatorId) {
      where.operatorId = filters.operatorId;
    }
    if (filters.state) {
      where.partner = { state: filters.state };
    }

    return where;
  }

  private buildProjectionSaleWhere(
    filters: DashboardFiltersDto,
    since: Date,
  ): Prisma.SaleWhereInput {
    const where: Prisma.SaleWhereInput = {
      status: { in: PIPELINE_SALE_STATUSES },
      reviewStatus: {
        notIn: [SaleReviewStatus.REJECTED, SaleReviewStatus.CANCELLED],
      },
      OR: [
        { activatedAt: { gte: since } },
        { activatedAt: null, createdAt: { gte: since } },
        {
          status: { in: IN_PROGRESS_SALE_STATUSES },
          createdAt: { gte: since },
        },
      ],
    };

    if (filters.partnerId) {
      where.partnerId = filters.partnerId;
    }
    if (filters.campaignId) {
      where.campaignId = filters.campaignId;
    }
    if (filters.operatorId) {
      where.operatorId = filters.operatorId;
    }
    if (filters.state) {
      where.partner = { state: filters.state };
    }

    return where;
  }

  private buildStatusSaleWhere(
    filters: DashboardFiltersDto,
    since: Date,
    statuses: SaleStatus[],
    options?: { byCancelledAt?: boolean },
  ): Prisma.SaleWhereInput {
    const where: Prisma.SaleWhereInput = {
      status: { in: statuses },
    };

    if (options?.byCancelledAt) {
      where.OR = [
        { cancelledAt: { gte: since } },
        { cancelledAt: null, updatedAt: { gte: since } },
        { cancelledAt: null, createdAt: { gte: since } },
      ];
    } else {
      where.createdAt = { gte: since };
    }

    if (filters.partnerId) {
      where.partnerId = filters.partnerId;
    }
    if (filters.campaignId) {
      where.campaignId = filters.campaignId;
    }
    if (filters.operatorId) {
      where.operatorId = filters.operatorId;
    }
    if (filters.state) {
      where.partner = { state: filters.state };
    }

    return where;
  }

  private buildPartnerWhere(filters: DashboardFiltersDto): Prisma.PartnerWhereInput {
    const where: Prisma.PartnerWhereInput = {};

    if (filters.partnerId) {
      where.id = filters.partnerId;
    }
    if (filters.state) {
      where.state = filters.state;
    }
    if (filters.campaignId || filters.operatorId) {
      where.sales = {
        some: {
          status: realizedSaleStatusFilter(),
          ...(filters.campaignId && { campaignId: filters.campaignId }),
          ...(filters.operatorId && { operatorId: filters.operatorId }),
        },
      };
    }

    return where;
  }

  private buildLineWhere(filters: DashboardFiltersDto): Prisma.LineWhereInput {
    const where: Prisma.LineWhereInput = {};

    if (filters.partnerId) {
      where.partnerId = filters.partnerId;
    }
    if (filters.operatorId) {
      where.operatorId = filters.operatorId;
    }
    if (filters.state) {
      where.partner = { state: filters.state };
    }
    if (filters.campaignId) {
      where.sales = {
        some: {
          campaignId: filters.campaignId,
          status: realizedSaleStatusFilter(),
        },
      };
    }

    return where;
  }

  private buildCommissionWhere(
    filters: DashboardFiltersDto,
    since: Date,
    branchId?: string,
  ): Prisma.CommissionWhereInput {
    const where: Prisma.CommissionWhereInput = {
      sale: {
        status: realizedSaleStatusFilter(),
        OR: [
          { activatedAt: { gte: since } },
          { activatedAt: null, createdAt: { gte: since } },
        ],
        ...(branchId && { branchId }),
        ...(filters.campaignId && { campaignId: filters.campaignId }),
        ...(filters.operatorId && { operatorId: filters.operatorId }),
      },
    };

    if (filters.partnerId) {
      where.partnerId = filters.partnerId;
    }
    if (filters.state) {
      where.partner = { state: filters.state };
    }
    return where;
  }

  private async getSalesChart(
    since: Date,
    filters: DashboardFiltersDto = {},
    branchId?: string,
  ) {
    const sales = await this.prisma.sale.findMany({
      where: {
        ...this.buildSaleWhere(filters, since),
        ...(branchId && { branchId }),
      },
      select: { createdAt: true, activatedAt: true, value: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, number> = {};
    for (const sale of sales) {
      const when = sale.activatedAt ?? sale.createdAt;
      const date = when.toISOString().split('T')[0];
      grouped[date] = (grouped[date] ?? 0) + Number(sale.value);
    }

    return Object.entries(grouped).map(([date, value]) => ({ date, value }));
  }

  private async getMonthlyChart(partnerId: string, branchId?: string) {
    const now = new Date();
    const months: { month: string; value: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const count = await this.prisma.sale.count({
        where: {
          partnerId,
          ...(branchId && { branchId }),
          createdAt: { gte: start, lte: end },
          status: realizedSaleStatusFilter(),
        },
      });
      months.push({
        month: start.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        value: count,
      });
    }

    return months;
  }

  private emptyPartnerMetrics(): DashboardPartnerMetrics {
    return {
      salesToday: 0,
      salesMonth: 0,
      activeLines: 0,
      cancelledLines: 0,
      goal: 0,
      goalProgress: 0,
      forecastCommission: 0,
      paidCommission: 0,
      ranking: 0,
      salesChart: [],
      monthlyChart: [],
      topProducts: [],
      topOperators: [],
    };
  }
}
