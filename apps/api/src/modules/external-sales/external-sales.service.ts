import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ExternalSalesQueryDto } from './dto/external-sales.dto';

const saleListSelect = {
  id: true,
  protocol: true,
  status: true,
  reviewStatus: true,
  contractStage: true,
  value: true,
  commissionValue: true,
  commissionRate: true,
  isPortability: true,
  isVirginChip: true,
  portabilityNumber: true,
  donorOperator: true,
  newNumber: true,
  chipIccid: true,
  approvedAt: true,
  activatedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  partner: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  client: {
    select: {
      id: true,
      name: true,
      document: true,
      documentType: true,
      phone: true,
      email: true,
      city: true,
      state: true,
    },
  },
  operator: { select: { id: true, name: true } },
  plan: { select: { id: true, name: true } },
  campaign: { select: { id: true, title: true } },
} satisfies Prisma.SaleSelect;

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : Number(value);
}

function mapSale(sale: Prisma.SaleGetPayload<{ select: typeof saleListSelect }>) {
  return {
    id: sale.id,
    protocol: sale.protocol,
    status: sale.status,
    reviewStatus: sale.reviewStatus,
    contractStage: sale.contractStage,
    value: decimalToNumber(sale.value),
    commissionValue: decimalToNumber(sale.commissionValue),
    commissionRate: decimalToNumber(sale.commissionRate),
    isPortability: sale.isPortability,
    isVirginChip: sale.isVirginChip,
    portabilityNumber: sale.portabilityNumber,
    donorOperator: sale.donorOperator,
    newNumber: sale.newNumber,
    chipIccid: sale.chipIccid,
    approvedAt: sale.approvedAt,
    activatedAt: sale.activatedAt,
    cancelledAt: sale.cancelledAt,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    partner: sale.partner,
    branch: sale.branch,
    client: sale.client,
    operator: sale.operator,
    plan: sale.plan,
    campaign: sale.campaign,
  };
}

@Injectable()
export class ExternalSalesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ExternalSalesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = this.buildWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: saleListSelect,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data: rows.map(mapSale),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOne(idOrProtocol: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idOrProtocol,
      );

    if (isUuid) {
      const byId = await this.prisma.sale.findUnique({
        where: { id: idOrProtocol },
        select: saleListSelect,
      });
      if (byId) return mapSale(byId);
    }

    const byProtocol = await this.prisma.sale.findUnique({
      where: { protocol: idOrProtocol },
      select: saleListSelect,
    });

    if (!byProtocol) {
      throw new NotFoundException('Venda não encontrada');
    }

    return mapSale(byProtocol);
  }

  private buildWhere(query: ExternalSalesQueryDto): Prisma.SaleWhereInput {
    const where: Prisma.SaleWhereInput = {};

    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.onlyActivated) {
      where.status = SaleStatus.ACTIVATED;
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
      if (query.createdTo) where.createdAt.lte = new Date(query.createdTo);
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { protocol: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { document: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }
}
