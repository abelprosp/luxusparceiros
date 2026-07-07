import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(
    user: AuthUser,
    params: { page: number; limit: number; search?: string; partnerId?: string },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.ClientWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { document: { contains: params.search } },
        { phone: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: { partner: { select: { id: true, name: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { partner: { select: { id: true, name: true } } },
    });
    if (!client) throw new NotFoundException(MESSAGES.NOT_FOUND);
    assertPartnerAccess(user, client.partnerId);
    return client;
  }

  async create(dto: CreateClientDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);
    if (!partnerId) {
      throw new ForbiddenException('Parceiro é obrigatório para criar cliente');
    }

    const client = await this.prisma.client.create({
      data: { ...dto, partnerId },
      include: { partner: { select: { id: true, name: true } } },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'clients',
      entityId: client.id,
      entityType: 'Client',
      newData: client as unknown as Prisma.InputJsonValue,
    });

    return client;
  }

  async update(id: string, dto: UpdateClientDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    if (dto.partnerId && !isAdminRole(user.role)) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: dto,
      include: { partner: { select: { id: true, name: true } } },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'clients',
      entityId: id,
      entityType: 'Client',
      oldData: existing as unknown as Prisma.InputJsonValue,
      newData: client as unknown as Prisma.InputJsonValue,
    });

    return client;
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.prisma.client.delete({ where: { id } });
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'clients',
      entityId: id,
      entityType: 'Client',
    });
    return { message: 'Cliente removido com sucesso' };
  }
}
