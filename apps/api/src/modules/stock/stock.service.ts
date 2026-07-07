import { BadRequestException, Injectable } from '@nestjs/common';
import { LineStatus, Prisma, StockMovementType, UserRole } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { resolvePartnerId } from '@/common/utils/partner-scope';
import { CreateStockMovementDto } from './dto/stock.dto';

interface CsvRow {
  iccid?: string;
  number?: string;
  operatorId?: string;
  partnerId?: string;
}

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(
    user: AuthUser,
    params: { page: number; limit: number; type?: StockMovementType; partnerId?: string },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.StockMovementWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (params.type) where.type = params.type;

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async getSummary(user: AuthUser) {
    if (user.role === UserRole.PARTNER) {
      if (!user.partnerId) {
        return {
          myAvailable: 0,
          myReserved: 0,
          generalAvailable: 0,
          totalLines: 0,
          chips: 0,
        };
      }

      const partnerId = user.partnerId;
      const [myAvailable, myReserved, generalAvailable, chips] = await Promise.all([
        this.prisma.line.count({ where: { partnerId, status: LineStatus.AVAILABLE } }),
        this.prisma.line.count({ where: { partnerId, status: LineStatus.RESERVED } }),
        this.prisma.line.count({ where: { partnerId: null, status: LineStatus.AVAILABLE } }),
        this.prisma.simCard.count({ where: { partnerId } }),
      ]);

      return {
        myAvailable,
        myReserved,
        generalAvailable,
        totalLines: myAvailable + myReserved + generalAvailable,
        chips,
      };
    }

    const [chipsTotal, chipsAvailable, linesTotal, linesAvailable, linesGeneral] = await Promise.all([
      this.prisma.simCard.count(),
      this.prisma.simCard.count({ where: { status: LineStatus.AVAILABLE } }),
      this.prisma.line.count(),
      this.prisma.line.count({ where: { status: LineStatus.AVAILABLE } }),
      this.prisma.line.count({ where: { partnerId: null, status: LineStatus.AVAILABLE } }),
    ]);

    return {
      chipsTotal,
      chipsAvailable,
      linesTotal,
      linesAvailable,
      linesGeneral,
    };
  }

  async exportCsv(user: AuthUser): Promise<string> {
    const partnerId = resolvePartnerId(user);
    const simWhere: Prisma.SimCardWhereInput = partnerId ? { partnerId } : {};
    const lineWhere: Prisma.LineWhereInput = partnerId ? { partnerId } : {};

    const [simCards, lines] = await Promise.all([
      this.prisma.simCard.findMany({
        where: simWhere,
        include: { operator: { select: { name: true } }, partner: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.line.findMany({
        where: lineWhere,
        include: { operator: { select: { name: true } }, partner: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = 'tipo,iccid,numero,operadora,parceiro,status';
    const rows = [
      ...simCards.map((item) =>
        ['chip', item.iccid, '', item.operator.name, item.partner?.name ?? '', item.status]
          .map((v) => escape(String(v)))
          .join(','),
      ),
      ...lines.map((item) =>
        ['linha', '', item.number, item.operator.name, item.partner?.name ?? '', item.status]
          .map((v) => escape(String(v)))
          .join(','),
      ),
    ];

    return [header, ...rows].join('\n');
  }

  async create(dto: CreateStockMovementDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);

    const movement = await this.prisma.stockMovement.create({
      data: {
        type: dto.type,
        partnerId,
        operatorId: dto.operatorId,
        iccid: dto.iccid,
        number: dto.number,
        quantity: dto.quantity ?? 1,
        notes: dto.notes,
        userId: user.id,
      },
      include: {
        user: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
    });

    if (dto.type === StockMovementType.ENTRY && dto.iccid && dto.operatorId) {
      await this.prisma.simCard.upsert({
        where: { iccid: dto.iccid },
        create: {
          iccid: dto.iccid,
          operatorId: dto.operatorId,
          partnerId,
          status: LineStatus.AVAILABLE,
        },
        update: { partnerId, status: LineStatus.AVAILABLE },
      });
    }

    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'stock',
      entityId: movement.id,
      entityType: 'StockMovement',
    });

    return movement;
  }

  async importCsv(csvContent: string, user: AuthUser, defaultOperatorId?: string) {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new BadRequestException('CSV deve conter cabeçalho e ao menos uma linha');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const results = { imported: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: CsvRow = {};
      headers.forEach((header, idx) => {
        (row as Record<string, string>)[header] = values[idx];
      });

      try {
        if (row.iccid) {
          const operatorId = row.operatorId ?? defaultOperatorId;
          if (!operatorId) {
            results.errors.push(`Linha ${i + 1}: operatorId é obrigatório`);
            continue;
          }

          await this.prisma.simCard.upsert({
            where: { iccid: row.iccid },
            create: {
              iccid: row.iccid,
              operatorId,
              partnerId: row.partnerId,
              status: LineStatus.AVAILABLE,
            },
            update: { partnerId: row.partnerId },
          });

          await this.prisma.stockMovement.create({
            data: {
              type: StockMovementType.ENTRY,
              iccid: row.iccid,
              operatorId,
              partnerId: row.partnerId,
              userId: user.id,
              notes: 'Importação CSV',
            },
          });

          results.imported++;
        }

        if (row.number && row.operatorId) {
          await this.prisma.line.upsert({
            where: { number: row.number },
            create: {
              number: row.number,
              operatorId: row.operatorId ?? defaultOperatorId!,
              partnerId: row.partnerId,
              status: LineStatus.AVAILABLE,
            },
            update: { partnerId: row.partnerId },
          });

          await this.prisma.stockMovement.create({
            data: {
              type: StockMovementType.ENTRY,
              number: row.number,
              operatorId: row.operatorId ?? defaultOperatorId,
              partnerId: row.partnerId,
              userId: user.id,
              notes: 'Importação CSV',
            },
          });

          results.imported++;
        }
      } catch (error) {
        results.errors.push(`Linha ${i + 1}: ${(error as Error).message}`);
      }
    }

    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'stock',
      entityType: 'CsvImport',
      newData: results as unknown as Prisma.InputJsonValue,
    });

    return results;
  }
}
