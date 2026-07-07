import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  module: string;
  entityId?: string;
  entityType?: string;
  oldData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({ data: input });
  }

  async findAll(params: {
    page: number;
    limit: number;
    module?: string;
    userId?: string;
    action?: AuditAction;
  }) {
    const { page, limit, module, userId, action } = params;
    const where: Prisma.AuditLogWhereInput = {};
    if (module) where.module = module;
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
