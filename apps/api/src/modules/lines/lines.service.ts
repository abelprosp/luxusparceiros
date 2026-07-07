import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LineStatus, Prisma } from '@prisma/client';
import { AuthUser, UserRole } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, resolvePartnerId } from '@/common/utils/partner-scope';
import { CreateLineDto, ReserveLineDto, UpdateLineDto } from './dto/line.dto';

@Injectable()
export class LinesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(
    user: AuthUser,
    params: {
      page: number;
      limit: number;
      search?: string;
      status?: LineStatus;
      partnerId?: string;
      generalOnly?: boolean;
    },
  ) {
    const where: Prisma.LineWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) where.number = { contains: params.search };

    if (user.role === UserRole.PARTNER) {
      if (!user.partnerId) {
        throw new ForbiddenException(MESSAGES.PARTNER_SCOPE_REQUIRED);
      }
      where.OR = [
        { partnerId: user.partnerId },
        { partnerId: null, status: LineStatus.AVAILABLE },
      ];
    } else {
      const partnerId = resolvePartnerId(user, params.partnerId);
      if (params.generalOnly) where.partnerId = null;
      else if (partnerId) where.partnerId = partnerId;
    }

    const [data, total] = await Promise.all([
      this.prisma.line.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          operator: { select: { id: true, name: true } },
          plan: { select: { id: true, name: true } },
          partner: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
        },
      }),
      this.prisma.line.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string, user: AuthUser) {
    const line = await this.prisma.line.findUnique({
      where: { id },
      include: {
        operator: true,
        plan: true,
        partner: true,
        client: true,
        simCard: true,
      },
    });
    if (!line) throw new NotFoundException(MESSAGES.NOT_FOUND);
    if (line.partnerId) assertPartnerAccess(user, line.partnerId);
    return line;
  }

  async create(dto: CreateLineDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);

    const exists = await this.prisma.line.findUnique({ where: { number: dto.number } });
    if (exists) throw new ConflictException('Número de linha já cadastrado');

    const line = await this.prisma.line.create({
      data: { ...dto, partnerId },
      include: { operator: true, plan: true, partner: true },
    });
    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'lines',
      entityId: line.id,
      entityType: 'Line',
    });
    return line;
  }

  async update(id: string, dto: UpdateLineDto, user: AuthUser) {
    await this.findOne(id, user);
    const line = await this.prisma.line.update({
      where: { id },
      data: dto,
      include: { operator: true, plan: true, partner: true },
    });
    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'lines',
      entityId: id,
      entityType: 'Line',
    });
    return line;
  }

  async reserve(id: string, dto: ReserveLineDto, user: AuthUser) {
    const line = await this.findOne(id, user);
    if (line.status !== LineStatus.AVAILABLE) {
      throw new BadRequestException(MESSAGES.LINE_NOT_AVAILABLE);
    }

    const partnerId = resolvePartnerId(user, dto.partnerId ?? line.partnerId ?? undefined);
    if (!partnerId) {
      throw new ForbiddenException('Parceiro é obrigatório para reservar linha');
    }

    const updated = await this.prisma.line.update({
      where: { id },
      data: {
        status: LineStatus.RESERVED,
        partnerId,
        reservedAt: new Date(),
      },
      include: { operator: true, partner: true },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'lines',
      entityId: id,
      entityType: 'Line',
      newData: { action: 'reserve', partnerId } as Prisma.InputJsonValue,
    });

    return updated;
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.prisma.line.delete({ where: { id } });
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'lines',
      entityId: id,
      entityType: 'Line',
    });
    return { message: 'Linha removida com sucesso' };
  }
}
