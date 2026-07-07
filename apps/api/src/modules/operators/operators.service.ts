import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { slugify } from '@luxus/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/operator.dto';

@Injectable()
export class OperatorsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(params: { page: number; limit: number; search?: string }) {
    const where: Prisma.OperatorWhereInput = params.search
      ? { name: { contains: params.search, mode: 'insensitive' } }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.operator.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { plans: true, lines: true } } },
      }),
      this.prisma.operator.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id },
      include: { plans: true, _count: { select: { lines: true, simCards: true } } },
    });
    if (!operator) throw new NotFoundException(MESSAGES.NOT_FOUND);
    return operator;
  }

  async create(dto: CreateOperatorDto, actorId?: string) {
    const operator = await this.prisma.operator.create({
      data: { ...dto, slug: slugify(dto.name) },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'CREATE',
      module: 'operators',
      entityId: operator.id,
      entityType: 'Operator',
    });
    return operator;
  }

  async update(id: string, dto: UpdateOperatorDto, actorId?: string) {
    await this.findOne(id);
    const data: Prisma.OperatorUpdateInput = { ...dto };
    if (dto.name) data.slug = slugify(dto.name);
    const operator = await this.prisma.operator.update({ where: { id }, data });
    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE',
      module: 'operators',
      entityId: id,
      entityType: 'Operator',
    });
    return operator;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.operator.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DELETE',
      module: 'operators',
      entityId: id,
      entityType: 'Operator',
    });
    return { message: 'Operadora removida com sucesso' };
  }
}
