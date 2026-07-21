import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialType, Prisma } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { resolvePartnerId } from '@/common/utils/partner-scope';
import { CreateFinancialRecordDto, UpdateFinancialRecordDto } from './dto/financial.dto';

@Injectable()
export class FinancialService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(
    user: AuthUser,
    params: { page: number; limit: number; type?: FinancialType; partnerId?: string },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.FinancialRecordWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (params.type) where.type = params.type;

    const [data, total] = await Promise.all([
      this.prisma.financialRecord.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { date: 'desc' },
      }),
      this.prisma.financialRecord.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string, user: AuthUser) {
    const record = await this.prisma.financialRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(MESSAGES.NOT_FOUND);
    if (user.partnerId && record.partnerId !== user.partnerId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }
    return record;
  }

  async create(dto: CreateFinancialRecordDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);
    const record = await this.prisma.financialRecord.create({
      data: {
        ...dto,
        partnerId,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
    });
    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'financial',
      entityId: record.id,
      entityType: 'FinancialRecord',
    });
    return record;
  }

  async update(id: string, dto: UpdateFinancialRecordDto, user: AuthUser) {
    await this.findOne(id, user);
    if (dto.partnerId) resolvePartnerId(user, dto.partnerId);
    const data: Prisma.FinancialRecordUpdateInput = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    const record = await this.prisma.financialRecord.update({ where: { id }, data });
    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'financial',
      entityId: id,
      entityType: 'FinancialRecord',
    });
    return record;
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.prisma.financialRecord.delete({ where: { id } });
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'financial',
      entityId: id,
      entityType: 'FinancialRecord',
    });
    return { message: 'Registro financeiro removido com sucesso' };
  }
}
