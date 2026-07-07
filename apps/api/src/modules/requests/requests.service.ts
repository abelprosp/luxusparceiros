import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RequestStatus, Prisma } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { generateProtocol } from '@luxus/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { EventsGateway } from '@/gateway/events.gateway';
import { MESSAGES } from '@/common/constants/messages';
import { assertBranchBelongsToPartner, resolveBranchId } from '@/common/utils/branch-scope';
import { assertPartnerAccess, isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import {
  CreateRequestCommentDto,
  CreateRequestDto,
  UpdateRequestDto,
  UpdateRequestStatusDto,
} from './dto/request.dto';

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
  ) {}

  async findAll(
    user: AuthUser,
    params: {
      page: number;
      limit: number;
      search?: string;
      status?: RequestStatus;
      partnerId?: string;
      branchId?: string;
    },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const branchId = resolveBranchId(user, params.branchId);
    const where: Prisma.RequestWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (branchId) where.branchId = branchId;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { protocol: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.request.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          partner: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.request.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string, user: AuthUser) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: {
        partner: true,
        client: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true } } },
        },
        timeline: { orderBy: { createdAt: 'asc' } },
        documents: true,
      },
    });
    if (!request) throw new NotFoundException(MESSAGES.NOT_FOUND);
    assertPartnerAccess(user, request.partnerId);
    if (user.branchId && request.branchId !== user.branchId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }

    if (!isAdminRole(user.role)) {
      return {
        ...request,
        comments: request.comments.filter((c) => !c.isInternal),
      };
    }
    return request;
  }

  async create(dto: CreateRequestDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);
    if (!partnerId) throw new ForbiddenException('Parceiro é obrigatório');
    const branchId = resolveBranchId(user, dto.branchId);

    if (branchId) {
      await assertBranchBelongsToPartner(this.prisma, branchId, partnerId);
    }

    const request = await this.prisma.request.create({
      data: {
        protocol: generateProtocol('REQ'),
        type: dto.type,
        description: dto.description,
        partnerId,
        branchId,
        clientId: dto.clientId,
        createdById: user.id,
      },
      include: {
        partner: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.addTimeline(request.id, 'Solicitação criada', null, RequestStatus.OPEN, user.id);
    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'requests',
      entityId: request.id,
      entityType: 'Request',
    });

    this.eventsGateway.emitToPartner(partnerId, 'request:created', request);
    return request;
  }

  async update(id: string, dto: UpdateRequestDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    const request = await this.prisma.request.update({
      where: { id },
      data: dto,
      include: {
        partner: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    if (dto.status && dto.status !== existing.status) {
      await this.addTimeline(id, 'Status alterado', existing.status, dto.status, user.id);
      if (dto.status === RequestStatus.COMPLETED) {
        await this.prisma.request.update({
          where: { id },
          data: { completedAt: new Date(), resolution: dto.resolution },
        });
      }
    }

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'requests',
      entityId: id,
      entityType: 'Request',
    });

    this.eventsGateway.emitToPartner(existing.partnerId, 'request:updated', request);
    return request;
  }

  async updateStatus(id: string, dto: UpdateRequestStatusDto, user: AuthUser) {
    return this.update(id, dto, user);
  }

  async addComment(id: string, dto: CreateRequestCommentDto, user: AuthUser) {
    const request = await this.findOne(id, user);

    if (dto.isInternal && !isAdminRole(user.role)) {
      dto.isInternal = false;
    }

    const comment = await this.prisma.requestComment.create({
      data: {
        requestId: id,
        userId: user.id,
        content: dto.content,
        isInternal: dto.isInternal ?? false,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await this.addTimeline(id, 'Comentário adicionado', null, null, user.id, dto.content);

    if (!comment.isInternal) {
      await this.notificationsService.createForPartnerUsers(request.partnerId, {
        type: 'REQUEST',
        title: 'Novo comentário na solicitação',
        message: `Solicitação ${request.protocol} recebeu um novo comentário.`,
        data: { requestId: id },
      });
      this.eventsGateway.emitToPartner(request.partnerId, 'request:comment', comment);
    }

    return comment;
  }

  async remove(id: string, user: AuthUser) {
    const request = await this.findOne(id, user);
    if (request.status === RequestStatus.COMPLETED) {
      throw new BadRequestException('Solicitação concluída não pode ser removida');
    }
    await this.prisma.request.delete({ where: { id } });
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'requests',
      entityId: id,
      entityType: 'Request',
    });
    return { message: 'Solicitação removida com sucesso' };
  }

  async exportCsv(
    user: AuthUser,
    params: { status?: RequestStatus; branchId?: string },
  ): Promise<string> {
    const partnerId = resolvePartnerId(user);
    const where: Prisma.RequestWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (params.status) where.status = params.status;
    if (params.branchId) where.branchId = params.branchId;

    const requests = await this.prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { name: true } },
        branch: { select: { name: true } },
        client: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    const header = 'Protocolo,Tipo,Status,Parceiro,Filial,Cliente,Descrição,Criado em,Criado por';
    const rows = requests.map((r) =>
      [
        r.protocol,
        r.type,
        r.status,
        r.partner.name,
        r.branch?.name ?? '',
        r.client?.name ?? '',
        `"${r.description.replace(/"/g, '""')}"`,
        r.createdAt.toISOString(),
        r.createdBy.name,
      ].join(','),
    );

    await this.auditService.log({
      userId: user.id,
      action: 'EXPORT',
      module: 'requests',
      entityType: 'Request',
    });

    return [header, ...rows].join('\n');
  }

  private async addTimeline(
    requestId: string,
    action: string,
    fromStatus: RequestStatus | null,
    toStatus: RequestStatus | null,
    userId?: string,
    details?: string,
  ) {
    return this.prisma.requestTimeline.create({
      data: { requestId, action, fromStatus, toStatus, userId, details },
    });
  }
}
