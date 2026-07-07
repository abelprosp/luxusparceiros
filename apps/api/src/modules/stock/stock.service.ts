import { BadRequestException, Injectable } from '@nestjs/common';
import { LineStatus, Prisma, StockMovementType } from '@prisma/client';
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
