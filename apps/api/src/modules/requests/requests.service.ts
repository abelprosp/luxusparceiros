import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RequestStatus, RequestType, Prisma } from '@prisma/client';
import { AuthUser, UserRole } from '@luxus/types';
import { generateProtocol } from '@luxus/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { EventsGateway } from '@/gateway/events.gateway';
import { TaskIntegrationService } from '@/modules/task-integration/task-integration.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertBranchBelongsToPartner, resolveBranchId } from '@/common/utils/branch-scope';
import { assertPartnerAccess, isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import {
  CreateRequestCommentDto,
  CreateRequestDto,
  RespondRequestDto,
  UpdateRequestDto,
  UpdateRequestStatusDto,
} from './dto/request.dto';

const REQUEST_STATUS_MESSAGES: Record<RequestStatus, string> = {
  OPEN: 'Aberta',
  IN_ANALYSIS: 'Em análise',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  REJECTED: 'Rejeitada',
};

const REQUEST_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  OPEN: [RequestStatus.IN_ANALYSIS, RequestStatus.IN_PROGRESS, RequestStatus.REJECTED],
  IN_ANALYSIS: [RequestStatus.OPEN, RequestStatus.IN_PROGRESS, RequestStatus.REJECTED],
  IN_PROGRESS: [RequestStatus.IN_ANALYSIS, RequestStatus.COMPLETED, RequestStatus.REJECTED],
  COMPLETED: [RequestStatus.IN_PROGRESS],
  REJECTED: [RequestStatus.IN_ANALYSIS],
};

interface TaskSyncSource {
  id: string;
  protocol: string;
  type: RequestType;
  description: string;
  partner: { name: string };
  branch?: { name: string } | null;
  client?: { name: string } | null;
  createdBy: { name: string; email: string };
  taskClientId?: string | null;
  taskClientName?: string | null;
  taskClientDocumentType?: string | null;
  taskClientDocument?: string | null;
  taskDeadline?: string | null;
  taskPriority?: boolean;
  taskSyncAttempts?: number;
}

@Injectable()
export class RequestsService implements OnModuleInit, OnModuleDestroy {
  private taskSyncTimer?: NodeJS.Timeout;
  private taskSyncRunning = false;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
    private taskIntegration: TaskIntegrationService,
  ) {}

  onModuleInit() {
    this.taskSyncTimer = setInterval(() => {
      void this.processTaskSyncQueue();
    }, 30_000);
    this.taskSyncTimer.unref();
    setImmediate(() => void this.processTaskSyncQueue());
  }

  onModuleDestroy() {
    if (this.taskSyncTimer) clearInterval(this.taskSyncTimer);
  }

  async findAll(
    user: AuthUser,
    params: {
      page: number;
      limit: number;
      search?: string;
      status?: RequestStatus;
      type?: RequestType;
      partnerId?: string;
      branchId?: string;
    },
  ) {
    const where = this.buildWhere(user, params);
    await this.syncLinkedTaskStatuses(where);

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

  async findKanban(
    user: AuthUser,
    params: {
      search?: string;
      status?: RequestStatus;
      type?: RequestType;
      partnerId?: string;
      branchId?: string;
    },
  ) {
    const where = this.buildWhere(user, params);
    await this.syncLinkedTaskStatuses(where);
    const data = await this.prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        partner: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    });

    return Object.values(RequestStatus).reduce<Record<RequestStatus, typeof data>>(
      (columns, status) => {
        columns[status] = data.filter((request) => request.status === status);
        return columns;
      },
      {} as Record<RequestStatus, typeof data>,
    );
  }

  async findOne(id: string, user: AuthUser) {
    let request = await this.prisma.request.findUnique({
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
    if (user.branchId && request.branchId && request.branchId !== user.branchId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }

    if (request.taskDemandId && this.taskIntegration.isConfigured()) {
      try {
        const taskDemand = await this.taskIntegration.getDemand(request.id);
        await this.taskIntegration.applyCallback({
          externalRequestId: request.id,
          demandId: taskDemand.id,
          protocol: taskDemand.protocol,
          status: taskDemand.status,
          resolution: taskDemand.resolution,
          observations: taskDemand.observations,
          responsibleId: taskDemand.responsible?.id,
          responsibleName: taskDemand.responsible?.name,
          updatedAt: taskDemand.updatedAt,
        });
        request = (await this.prisma.request.findUnique({
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
        }))!;
      } catch {
        // A tela continua disponível com o último estado conhecido.
      }
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

    const resolveInternally = dto.resolveInternally === true || !this.taskIntegration.isConfigured();

    if (!resolveInternally && this.taskIntegration.isConfigured()) {
      if (!dto.taskResponsibleId) {
        throw new BadRequestException('Selecione o responsável pela demanda');
      }
      const document = dto.taskClientDocument?.replace(/\D/g, '');
      const hasSelectedClient = Boolean(dto.taskClientId && dto.taskClientName);
      const hasManualClient = Boolean(
        dto.taskClientName
        && ['pf', 'pj'].includes(dto.taskClientDocumentType ?? '')
        && document
        && (
          (dto.taskClientDocumentType === 'pf' && document.length === 11)
          || (dto.taskClientDocumentType === 'pj' && document.length === 14)
        ),
      );
      if (!hasSelectedClient && !hasManualClient) {
        throw new BadRequestException(
          'Selecione um cliente do Luxus Task ou informe nome e CPF/CNPJ',
        );
      }
      if (!dto.taskDeadline) {
        throw new BadRequestException('Informe o prazo da demanda');
      }
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
        taskResponsibleId: resolveInternally ? undefined : dto.taskResponsibleId,
        taskClientId: resolveInternally ? undefined : dto.taskClientId,
        taskClientName: resolveInternally ? undefined : dto.taskClientName,
        taskClientDocumentType: resolveInternally ? undefined : dto.taskClientDocumentType,
        taskClientDocument: resolveInternally ? undefined : dto.taskClientDocument?.replace(/\D/g, ''),
        taskDeadline: resolveInternally ? undefined : dto.taskDeadline,
        taskPriority: resolveInternally ? false : (dto.taskPriority ?? false),
        taskSyncState: resolveInternally ? 'DISABLED' : 'PENDING',
        taskNextRetryAt: resolveInternally ? null : new Date(),
      },
      include: {
        partner: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.addTimeline(
      request.id,
      resolveInternally
        ? 'Solicitação criada (fluxo interno no Luxus Parceiros)'
        : 'Solicitação criada',
      null,
      RequestStatus.OPEN,
      user.id,
    );
    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'requests',
      entityId: request.id,
      entityType: 'Request',
    });

    this.eventsGateway.emitToPartner(partnerId, 'request:created', request);

    if (!resolveInternally && this.taskIntegration.isConfigured() && dto.taskResponsibleId) {
      setImmediate(() => void this.processTaskSyncQueue());
    }
    return request;
  }

  async retryTaskSync(id: string, user: AuthUser) {
    const request = await this.findOne(id, user);
    if (request.taskDemandId) {
      return request;
    }
    if (!request.taskResponsibleId) {
      throw new BadRequestException('Selecione um responsável do Luxus Task');
    }
    if (
      !request.taskDeadline
      || !request.taskClientName
      || (
        !request.taskClientId
        && (!request.taskClientDocumentType || !request.taskClientDocument)
      )
    ) {
      throw new BadRequestException('Cliente e prazo do Luxus Task são obrigatórios');
    }
    await this.prisma.request.update({
      where: { id },
      data: {
        taskSyncState: 'PENDING',
        taskSyncError: null,
        taskNextRetryAt: new Date(),
        taskSyncLockedAt: null,
      },
    });
    await this.processTaskSyncQueue();
    return this.findOne(id, user);
  }

  async update(id: string, dto: UpdateRequestDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    if (dto.partnerId && dto.partnerId !== existing.partnerId) {
      throw new BadRequestException('O parceiro da solicitação não pode ser alterado');
    }
    if (dto.status && existing.taskDemandId) {
      throw new BadRequestException(
        'O status desta demanda é controlado pelo Luxus Task',
      );
    }
    if (dto.status && dto.status !== existing.status) {
      this.assertStatusTransition(existing.status, dto.status);
    }
    if (dto.branchId) {
      await assertBranchBelongsToPartner(
        this.prisma,
        dto.branchId,
        existing.partnerId,
      );
    }
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, partnerId: existing.partnerId },
        select: { id: true },
      });
      if (!client) {
        throw new BadRequestException('Cliente inválido para esta solicitação');
      }
    }
    if (dto.assignedToId) {
      await this.assertAssignableUser(dto.assignedToId);
    }
    const { partnerId: _partnerId, ...updateData } = dto;
    const request = await this.prisma.request.update({
      where: { id },
      data: updateData,
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
      } else if (existing.status === RequestStatus.COMPLETED) {
        await this.prisma.request.update({
          where: { id },
          data: { completedAt: null },
        });
      }
      if (isAdminRole(user.role)) {
        await this.notificationsService.createForPartnerUsers(existing.partnerId, {
          type: 'REQUEST',
          title: 'Andamento da solicitação',
          message: `A solicitação ${existing.protocol} agora está ${REQUEST_STATUS_MESSAGES[dto.status].toLowerCase()}.`,
          data: { requestId: id },
        }, [user.id]);
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
        taskNextRetryAt:
          request.taskDemandId && !dto.isInternal ? new Date() : null,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await this.addTimeline(id, 'Comentário adicionado', null, null, user.id, dto.content);

    if (!comment.isInternal) {
      if (isAdminRole(user.role)) {
        await this.notificationsService.createForPartnerUsers(request.partnerId, {
          type: 'REQUEST',
          title: 'Novo comentário na solicitação',
          message: `A solicitação ${request.protocol} recebeu um novo comentário.`,
          data: { requestId: id },
        }, [user.id]);
      } else {
        await this.notificationsService.createForAdminUsers({
          type: 'REQUEST',
          title: 'Novo comentário de parceiro',
          message: `${user.name} comentou na solicitação ${request.protocol}.`,
          data: { requestId: id },
        }, [user.id]);
      }
      this.eventsGateway.emitToPartner(request.partnerId, 'request:comment', comment);
      if (request.taskDemandId) {
        setImmediate(() => void this.processTaskCommentQueue());
      }
    }

    return comment;
  }

  async remove(id: string, user: AuthUser) {
    const request = await this.findOne(id, user);
    if (request.taskDemandId) {
      throw new BadRequestException(
        'Demandas vinculadas ao Luxus Task não podem ser excluídas',
      );
    }
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

  async bulkRemove(ids: string[], user: AuthUser) {
    if (!isAdminRole(user.role)) throw new ForbiddenException('Apenas administradores podem excluir em lote');
    const requests = await this.prisma.request.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, protocol: true, taskDemandId: true },
    });
    const deleted: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];
    for (const request of requests) {
      try {
        await this.prisma.$transaction([
          this.prisma.document.deleteMany({ where: { requestId: request.id } }),
          this.prisma.request.delete({ where: { id: request.id } }),
        ]);
        deleted.push(request.id);
        await this.auditService.log({
          userId: user.id,
          action: 'DELETE',
          module: 'requests',
          entityId: request.id,
          entityType: 'Request',
          oldData: { bulk: true, protocol: request.protocol, taskDemandId: request.taskDemandId },
        });
      } catch (error) {
        failed.push({ id: request.id, reason: error instanceof Error ? error.message : 'Falha ao excluir' });
      }
    }
    for (const id of ids) {
      if (!requests.some((request) => request.id === id)) failed.push({ id, reason: 'Solicitação não encontrada' });
    }
    return {
      deleted,
      failed,
      warning: requests.some((request) => request.taskDemandId)
        ? 'As demandas já criadas no Luxus Task foram preservadas para manter a auditoria.'
        : undefined,
    };
  }

  async exportCsv(
    user: AuthUser,
    params: {
      search?: string;
      status?: RequestStatus;
      type?: RequestType;
      partnerId?: string;
      branchId?: string;
    },
  ): Promise<string> {
    const requests = await this.prisma.request.findMany({
      where: this.buildWhere(user, params),
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

  private buildWhere(
    user: AuthUser,
    params: {
      search?: string;
      status?: RequestStatus;
      type?: RequestType;
      partnerId?: string;
      branchId?: string;
    },
  ): Prisma.RequestWhereInput {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const branchId = resolveBranchId(user, params.branchId);
    const where: Prisma.RequestWhereInput = {};
    const and: Prisma.RequestWhereInput[] = [];
    if (partnerId) where.partnerId = partnerId;
    if (branchId) {
      if (user.role === UserRole.ATTENDANT) {
        and.push({ OR: [{ branchId }, { branchId: null }] });
      } else {
        where.branchId = branchId;
      }
    }
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    if (params.search?.trim()) {
      const search = params.search.trim();
      and.push({
        OR: [
          { protocol: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
          { partner: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    if (and.length) where.AND = and;
    return where;
  }

  private async syncLinkedTaskStatuses(where: Prisma.RequestWhereInput) {
    if (!this.taskIntegration.isConfigured()) return;

    const linked = await this.prisma.request.findMany({
      where: {
        AND: [
          where,
          { taskDemandId: { not: null } },
          { status: { notIn: [RequestStatus.COMPLETED, RequestStatus.REJECTED] } },
        ],
      },
      select: { id: true },
      orderBy: { taskLastSyncAt: 'asc' },
      take: 30,
    });

    await Promise.allSettled(
      linked.map(async ({ id }) => {
        try {
          const taskDemand = await this.taskIntegration.getDemand(id);
          await this.taskIntegration.applyCallback({
            externalRequestId: id,
            demandId: taskDemand.id,
            protocol: taskDemand.protocol,
            status: taskDemand.status,
            resolution: taskDemand.resolution,
            observations: taskDemand.observations,
            responsibleId: taskDemand.responsible?.id,
            responsibleName: taskDemand.responsible?.name,
            updatedAt: taskDemand.updatedAt,
          });
        } catch (error) {
          await this.prisma.request.update({
            where: { id },
            data: {
              taskLastSyncAt: new Date(),
              taskSyncError:
                error instanceof Error ? error.message : 'Falha ao consultar o Luxus Task',
            },
          });
        }
      }),
    );
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

  async respond(id: string, dto: RespondRequestDto, user: AuthUser) {
    const request = await this.findOne(id, user);
    const content = dto.content?.trim();
    const statusChanged = Boolean(dto.status && dto.status !== request.status);
    const resolutionChanged = Boolean(
      dto.resolution !== undefined
      && dto.resolution.trim() !== (request.resolution ?? '').trim(),
    );
    if (!content && !statusChanged && !resolutionChanged) {
      throw new BadRequestException('Informe um comentário ou uma alteração');
    }
    if ((statusChanged || resolutionChanged) && !isAdminRole(user.role)) {
      throw new ForbiddenException('Somente o atendimento pode alterar o andamento');
    }
    if ((statusChanged || resolutionChanged) && request.taskDemandId) {
      throw new BadRequestException('O andamento desta demanda é controlado pelo Luxus Task');
    }
    if (statusChanged) this.assertStatusTransition(request.status, dto.status!);
    const isInternal = Boolean(dto.isInternal && isAdminRole(user.role));

    await this.prisma.$transaction(async (tx) => {
      if (statusChanged || resolutionChanged) {
        await tx.request.update({
          where: { id },
          data: {
            ...(statusChanged && { status: dto.status }),
            ...(dto.resolution !== undefined && {
              resolution: dto.resolution.trim() || null,
            }),
            completedAt: dto.status === RequestStatus.COMPLETED
              ? new Date()
              : request.status === RequestStatus.COMPLETED ? null : undefined,
          },
        });
        await tx.requestTimeline.create({
          data: {
            requestId: id,
            action: statusChanged ? 'Status alterado' : 'Resolução alterada',
            fromStatus: request.status,
            toStatus: statusChanged ? dto.status : request.status,
            userId: user.id,
            details: dto.resolution?.trim() || undefined,
          },
        });
      }
      if (content) {
        await tx.requestComment.create({
          data: {
            requestId: id,
            userId: user.id,
            content,
            isInternal,
            taskNextRetryAt:
              request.taskDemandId && !isInternal ? new Date() : null,
          },
        });
        await tx.requestTimeline.create({
          data: {
            requestId: id,
            action: 'Comentário adicionado',
            userId: user.id,
            details: content,
          },
        });
      }
    });

    if (!isInternal) {
      if (isAdminRole(user.role)) {
        await this.notificationsService.createForPartnerUsers(request.partnerId, {
          type: 'REQUEST',
          title: 'Solicitação atualizada',
          message: `${request.protocol} recebeu uma atualização.`,
          data: { requestId: id },
        }, [user.id]);
      } else {
        await this.notificationsService.createForAdminUsers({
          type: 'REQUEST',
          title: 'Comentário de parceiro',
          message: `${user.name} comentou na solicitação ${request.protocol}.`,
          data: { requestId: id },
        }, [user.id]);
      }
    }
    if (content && request.taskDemandId && !isInternal) {
      setImmediate(() => void this.processTaskCommentQueue());
    }
    this.eventsGateway.emitToPartner(request.partnerId, 'request:updated', { id });
    return this.findOne(id, user);
  }

  private assertStatusTransition(from: RequestStatus, to: RequestStatus) {
    if (!REQUEST_STATUS_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(
        `Não é permitido alterar a solicitação de ${REQUEST_STATUS_MESSAGES[from]} para ${REQUEST_STATUS_MESSAGES[to]}`,
      );
    }
  }

  private async assertAssignableUser(userId: string) {
    const target = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        role: { in: ['ADMIN', 'SUPERVISOR'] },
      },
      select: { id: true },
    });
    if (!target) {
      throw new BadRequestException('Responsável inválido para a solicitação');
    }
  }

  private async sendToTask(
    request: TaskSyncSource,
    responsibleId: string,
    clientId: string | undefined | null,
    clientName: string,
    clientDocumentType: string | undefined | null,
    clientDocument: string | undefined | null,
    deadline: string,
    priority = false,
  ) {
    const typeLabel: Record<RequestType, string> = {
      NEW_ACTIVATION: 'Nova ativação',
      BLOCK: 'Bloqueio',
      UNBLOCK: 'Desbloqueio',
      CANCELLATION: 'Cancelamento',
      DELETION: 'Exclusão',
      CHIP_EXCHANGE: 'Troca de chip',
      PLAN_CHANGE: 'Troca de plano',
      PORTABILITY: 'Portabilidade',
      SECOND_COPY: 'Segunda via',
      REGISTRATION_CHANGE: 'Alteração cadastral',
    };
    try {
      const task = await this.taskIntegration.createDemand({
        requestId: request.id,
        responsibleId,
        clientId: clientId ?? undefined,
        clientName,
        clientDocumentType: clientDocumentType as 'pf' | 'pj' | undefined,
        clientDocument: clientDocument?.replace(/\D/g, '') || undefined,
        deadline,
        subject: `${typeLabel[request.type]} — ${request.partner.name}`,
        description: [
          request.description,
          request.client?.name ? `Cliente: ${request.client.name}` : '',
        ].filter(Boolean).join('\n\n'),
        localProtocol: request.protocol,
        partnerName: request.partner.name,
        branchName: request.branch?.name,
        requesterName: request.createdBy.name,
        requesterEmail: request.createdBy.email,
        priority,
      });
      return this.saveTaskLink(request, responsibleId, task);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar';
      const updated = await this.prisma.request.update({
        where: { id: request.id },
        data: {
          taskResponsibleId: responsibleId,
          taskSyncError: message,
          taskLastSyncAt: new Date(),
          taskSyncState: 'RETRY',
          taskSyncAttempts: { increment: 1 },
          taskNextRetryAt: new Date(
            Date.now() + this.retryDelayMs(request.taskSyncAttempts ?? 0),
          ),
          taskSyncLockedAt: null,
        },
        include: {
          partner: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
      if (!request.taskSyncAttempts) {
        await this.notificationsService.createForAdminUsers({
          type: 'SYSTEM',
          title: 'Falha ao enviar demanda ao Luxus Task',
          message: `${request.protocol} continuará tentando automaticamente. Motivo: ${message}`,
          data: { requestId: request.id },
        });
      }
      return updated;
    }
  }

  private async saveTaskLink(
    request: TaskSyncSource,
    responsibleId: string,
    task: Awaited<ReturnType<TaskIntegrationService['createDemand']>>,
  ) {
    const updated = await this.prisma.request.update({
      where: { id: request.id },
      data: {
        taskDemandId: task.id,
        taskProtocol: task.protocol,
        taskStatus: task.status,
        taskResponsibleId: task.responsible?.id ?? responsibleId,
        taskResponsibleName: task.responsible?.name,
        taskClientId: task.client?.id ?? request.taskClientId,
        taskClientName: task.client?.name ?? request.taskClientName,
        taskSyncError: null,
        taskLastSyncAt: new Date(),
        taskSyncState: 'SYNCED',
        taskNextRetryAt: null,
        taskSyncLockedAt: null,
      },
      include: {
        partner: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    await this.addTimeline(
      request.id,
      `Demanda ${task.protocol} vinculada ao Luxus Task`,
      null,
      null,
      undefined,
      task.responsible?.name
        ? `Responsável: ${task.responsible.name}`
        : undefined,
    );
    return updated;
  }

  private async processTaskSyncQueue() {
    if (this.taskSyncRunning || !this.taskIntegration.isConfigured()) return;
    this.taskSyncRunning = true;
    try {
      await this.prisma.request.updateMany({
        where: {
          taskSyncState: 'PROCESSING',
          taskSyncLockedAt: { lt: new Date(Date.now() - 5 * 60_000) },
        },
        data: {
          taskSyncState: 'RETRY',
          taskNextRetryAt: new Date(),
          taskSyncLockedAt: null,
        },
      });
      const candidates = await this.prisma.request.findMany({
        where: {
          taskDemandId: null,
          taskResponsibleId: { not: null },
          taskSyncState: { in: ['PENDING', 'RETRY'] },
          OR: [
            { taskNextRetryAt: null },
            { taskNextRetryAt: { lte: new Date() } },
          ],
        },
        select: { id: true },
        orderBy: [{ taskNextRetryAt: 'asc' }, { createdAt: 'asc' }],
        take: 10,
      });

      for (const candidate of candidates) {
        const claimed = await this.prisma.request.updateMany({
          where: {
            id: candidate.id,
            taskDemandId: null,
            taskSyncState: { in: ['PENDING', 'RETRY'] },
          },
          data: { taskSyncState: 'PROCESSING', taskSyncLockedAt: new Date() },
        });
        if (!claimed.count) continue;

        const request = await this.prisma.request.findUnique({
          where: { id: candidate.id },
          include: {
            partner: { select: { name: true } },
            branch: { select: { name: true } },
            client: { select: { name: true } },
            createdBy: { select: { name: true, email: true } },
          },
        });
        if (
          !request?.taskResponsibleId
          || !request.taskClientName
          || !request.taskDeadline
        ) {
          await this.prisma.request.update({
            where: { id: candidate.id },
            data: {
              taskSyncState: 'FAILED',
              taskSyncError: 'Dados obrigatórios da integração estão incompletos',
              taskSyncLockedAt: null,
            },
          });
          continue;
        }

        try {
          const existingTask = await this.taskIntegration.getDemand(request.id);
          await this.saveTaskLink(request, request.taskResponsibleId, existingTask);
          continue;
        } catch {
          // O POST remoto é idempotente pelo identificador desta solicitação.
        }

        await this.sendToTask(
          request,
          request.taskResponsibleId,
          request.taskClientId,
          request.taskClientName,
          request.taskClientDocumentType,
          request.taskClientDocument,
          request.taskDeadline,
          request.taskPriority,
        );
      }
    } finally {
      this.taskSyncRunning = false;
    }
    await this.processTaskCommentQueue();
  }

  private async processTaskCommentQueue() {
    if (!this.taskIntegration.isConfigured()) return;
    const comments = await this.prisma.requestComment.findMany({
      where: {
        isInternal: false,
        taskSyncedAt: null,
        taskNextRetryAt: { lte: new Date() },
        request: { taskDemandId: { not: null } },
      },
      include: {
        user: { select: { name: true } },
        request: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const comment of comments) {
      const claimed = await this.prisma.requestComment.updateMany({
        where: {
          id: comment.id,
          taskSyncedAt: null,
          taskNextRetryAt: { lte: new Date() },
        },
        data: { taskNextRetryAt: new Date(Date.now() + 5 * 60_000) },
      });
      if (!claimed.count) continue;
      try {
        await this.taskIntegration.addDemandComment(
          comment.request.id,
          comment.content,
          comment.user.name,
        );
        await this.prisma.requestComment.update({
          where: { id: comment.id },
          data: {
            taskSyncedAt: new Date(),
            taskSyncError: null,
            taskNextRetryAt: null,
          },
        });
      } catch (error) {
        await this.prisma.requestComment.update({
          where: { id: comment.id },
          data: {
            taskSyncAttempts: { increment: 1 },
            taskSyncError:
              error instanceof Error ? error.message : 'Falha ao sincronizar',
            taskNextRetryAt: new Date(
              Date.now() + this.retryDelayMs(comment.taskSyncAttempts),
            ),
          },
        });
      }
    }
  }

  private retryDelayMs(attempts: number) {
    const delays = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
    return delays[Math.min(attempts, delays.length - 1)];
  }
}
