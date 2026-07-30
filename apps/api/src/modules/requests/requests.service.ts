import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
}

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
    private taskIntegration: TaskIntegrationService,
  ) {}

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
    if (this.taskIntegration.isConfigured()) {
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
        taskResponsibleId: dto.taskResponsibleId,
        taskClientId: dto.taskClientId,
        taskClientName: dto.taskClientName,
        taskClientDocumentType: dto.taskClientDocumentType,
        taskClientDocument: dto.taskClientDocument?.replace(/\D/g, ''),
        taskDeadline: dto.taskDeadline,
        taskPriority: dto.taskPriority ?? false,
      },
      include: {
        partner: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
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

    if (this.taskIntegration.isConfigured() && dto.taskResponsibleId) {
      setImmediate(() => {
        void this.sendToTask(
          request,
          dto.taskResponsibleId!,
          dto.taskClientId,
          dto.taskClientName!,
          dto.taskClientDocumentType,
          dto.taskClientDocument,
          dto.taskDeadline!,
          dto.taskPriority,
        );
      });
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
    try {
      const existingTask = await this.taskIntegration.getDemand(request.id);
      return this.saveTaskLink(request, request.taskResponsibleId, existingTask);
    } catch {
      // Se o primeiro envio terminou no Task após o timeout, a consulta acima
      // recupera o vínculo. Um novo POST só ocorre quando não há vínculo remoto.
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
    return this.sendToTask(
      request,
      request.taskResponsibleId,
      request.taskClientId,
      request.taskClientName,
      request.taskClientDocumentType ?? undefined,
      request.taskClientDocument ?? undefined,
      request.taskDeadline,
      request.taskPriority,
    );
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
        },
        include: {
          partner: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
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
}
