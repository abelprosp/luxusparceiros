import { BadRequestException, Injectable } from '@nestjs/common';
import { LineStatus, Prisma, StockMovementType } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { resolvePartnerId } from '@/common/utils/partner-scope';
import { csvRow } from '@/common/utils/csv';
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
    if (user.branchId) where.branchId = user.branchId;
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
    if (user.partnerId) {
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
        take: 20_000,
      }),
      this.prisma.line.findMany({
        where: lineWhere,
        take: 20_000,
        include: { operator: { select: { name: true } }, partner: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const header = 'tipo,iccid,numero,operadora,parceiro,status';
    const rows = [
      ...simCards.map((item) =>
        csvRow(['chip', item.iccid, '', item.operator.name, item.partner?.name ?? '', item.status]),
      ),
      ...lines.map((item) =>
        csvRow(['linha', '', item.number, item.operator.name, item.partner?.name ?? '', item.status]),
      ),
    ];

    return [header, ...rows].join('\n');
  }

  async create(dto: CreateStockMovementDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);
    const iccid = dto.iccid?.replace(/\s/g, '') || undefined;
    const number = dto.number?.replace(/\D/g, '') || undefined;

    if (dto.type === StockMovementType.ENTRY && iccid && dto.operatorId) {
      await this.registerSimCard(iccid, dto.operatorId, partnerId, user);
    }

    const movement = await this.prisma.stockMovement.create({
      data: {
        type: dto.type,
        partnerId,
        branchId: user.branchId,
        operatorId: dto.operatorId,
        iccid,
        number,
        quantity: dto.quantity ?? 1,
        notes: dto.notes,
        userId: user.id,
      },
      include: {
        user: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
    });

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
    const lines = csvContent.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    if (lines.length < 2) {
      throw new BadRequestException('CSV deve conter cabeçalho e ao menos uma linha');
    }
    if (lines.length > 5001) {
      throw new BadRequestException('Importe no máximo 5.000 linhas por arquivo');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const results = { imported: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: CsvRow = {};
      headers.forEach((header, idx) => {
        (row as Record<string, string>)[header] = values[idx];
      });
      const headerAliases = row as Record<string, string | undefined>;
      row.operatorId = row.operatorId ?? headerAliases.operatorid;
      row.partnerId = row.partnerId ?? headerAliases.partnerid;

      try {
        const rowPartnerId = resolvePartnerId(user, row.partnerId || undefined);
        const operatorId = row.operatorId || defaultOperatorId;
        const iccid = row.iccid?.replace(/\s/g, '');
        const number = row.number?.replace(/\D/g, '');
        if ((iccid || number) && !operatorId) {
          results.errors.push(`Linha ${i + 1}: operatorId é obrigatório`);
          continue;
        }

        if (iccid && operatorId) {
          await this.registerSimCard(iccid, operatorId, rowPartnerId, user);
          await this.prisma.stockMovement.create({
            data: {
              type: StockMovementType.ENTRY,
              iccid,
              operatorId,
              partnerId: rowPartnerId,
              branchId: user.branchId,
              userId: user.id,
              notes: 'Importação CSV',
            },
          });
          results.imported++;
        }

        if (number && operatorId) {
          await this.registerLine(number, operatorId, rowPartnerId, user);
          await this.prisma.stockMovement.create({
            data: {
              type: StockMovementType.ENTRY,
              number,
              operatorId,
              partnerId: rowPartnerId,
              branchId: user.branchId,
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

  /**
   * Cadastra o chip ou confirma que ele já é do mesmo dono. Nunca troca o dono de um chip existente:
   * isso só pode ser feito pela administração da plataforma, fora da entrada de estoque.
   */
  private async registerSimCard(iccid: string, operatorId: string, partnerId: string | undefined, user: AuthUser) {
    const existing = await this.prisma.simCard.findUnique({
      where: { iccid },
      select: { partnerId: true, operatorId: true },
    });
    if (!existing) {
      await this.prisma.simCard.create({
        data: { iccid, operatorId, partnerId, status: LineStatus.AVAILABLE },
      });
      return;
    }
    this.assertSameOwner('Chip', existing.partnerId, partnerId, user);
    if (existing.operatorId !== operatorId) {
      throw new BadRequestException(`Chip ${iccid} já cadastrado em outra operadora`);
    }
  }

  private async registerLine(number: string, operatorId: string, partnerId: string | undefined, user: AuthUser) {
    const existing = await this.prisma.line.findUnique({
      where: { number },
      select: { partnerId: true, operatorId: true },
    });
    if (!existing) {
      await this.prisma.line.create({
        data: { number, operatorId, partnerId, status: LineStatus.AVAILABLE },
      });
      return;
    }
    this.assertSameOwner('Linha', existing.partnerId, partnerId, user);
    if (existing.operatorId !== operatorId) {
      throw new BadRequestException(`Linha ${number} já cadastrada em outra operadora`);
    }
  }

  private assertSameOwner(
    label: string,
    currentPartnerId: string | null,
    requestedPartnerId: string | undefined,
    user: AuthUser,
  ) {
    if ((currentPartnerId ?? null) === (requestedPartnerId ?? null)) return;
    if (!currentPartnerId && !user.partnerId) {
      throw new BadRequestException(
        `${label} já cadastrado no estoque geral. Use a tela do item para destiná-lo a um parceiro.`,
      );
    }
    throw new BadRequestException(`${label} já cadastrado para outro dono`);
  }
}
