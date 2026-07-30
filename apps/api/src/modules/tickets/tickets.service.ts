import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TicketStatus, Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { generateProtocol } from '@luxus/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { EventsGateway } from '@/gateway/events.gateway';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import {
  CreateTicketDto,
  CreateTicketMessageDto,
  RespondTicketDto,
  UpdateTicketDto,
  UpdateTicketStatusDto,
} from './dto/ticket.dto';

const TICKET_STATUS_MESSAGES: Record<TicketStatus, string> = {
  NEW: 'Novo',
  IN_PROGRESS: 'Em andamento',
  PENDING: 'Pendente',
  RESOLVED: 'Resolvido',
  CANCELLED: 'Cancelado',
};

const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  IN_PROGRESS: [TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  PENDING: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  RESOLVED: [TicketStatus.IN_PROGRESS],
  CANCELLED: [TicketStatus.IN_PROGRESS],
};

@Injectable()
export class TicketsService implements OnModuleInit, OnModuleDestroy {
  private slaTimer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
  ) {}

  onModuleInit() {
    this.slaTimer = setInterval(() => void this.notifyOverdueTickets(), 60_000);
    this.slaTimer.unref();
    setImmediate(() => void this.notifyOverdueTickets());
  }

  onModuleDestroy() {
    if (this.slaTimer) clearInterval(this.slaTimer);
  }

  async findAll(
    user: AuthUser,
    params: { page: number; limit: number; search?: string; status?: TicketStatus; partnerId?: string },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.TicketWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { protocol: { contains: params.search, mode: 'insensitive' } },
        { subject: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          partner: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async getKanban(user: AuthUser, partnerId?: string) {
    const scopedPartnerId = resolvePartnerId(user, partnerId);
    const where: Prisma.TicketWhereInput = scopedPartnerId ? { partnerId: scopedPartnerId } : {};

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    const columns: Record<TicketStatus, typeof tickets> = {
      NEW: [],
      IN_PROGRESS: [],
      PENDING: [],
      RESOLVED: [],
      CANCELLED: [],
    };

    for (const ticket of tickets) {
      columns[ticket.status].push(ticket);
    }

    return columns;
  }

  async findOne(id: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        partner: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true } } },
        },
        timeline: { orderBy: { createdAt: 'asc' } },
        documents: true,
      },
    });
    if (!ticket) throw new NotFoundException(MESSAGES.NOT_FOUND);
    if (ticket.partnerId) assertPartnerAccess(user, ticket.partnerId);

    if (!isAdminRole(user.role)) {
      return {
        ...ticket,
        messages: ticket.messages.filter((m) => !m.isInternal),
      };
    }
    return ticket;
  }

  async create(dto: CreateTicketDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId ?? user.partnerId);
    const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const ticket = await this.prisma.ticket.create({
      data: {
        protocol: generateProtocol('TKT'),
        subject: dto.subject,
        description: dto.description?.trim() || null,
        category: dto.category,
        priority: dto.priority,
        partnerId: partnerId ?? null,
        createdById: user.id,
        slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : slaDeadline,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
    });

    await this.addTimeline(ticket.id, 'Ticket criado', null, TicketStatus.NEW, user.id);
    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'tickets',
      entityId: ticket.id,
      entityType: 'Ticket',
    });

    if (partnerId) {
      this.eventsGateway.emitToPartner(partnerId, 'ticket:created', ticket);
    }
    if (!isAdminRole(user.role)) {
      await this.notificationsService.createForAdminUsers({
        type: 'SYSTEM',
        title: 'Novo chamado de parceiro',
        message: `${ticket.partner?.name ?? user.name} abriu o chamado ${ticket.protocol}: ${ticket.subject}.`,
        data: { ticketId: ticket.id },
      });
    }
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    if (
      !isAdminRole(user.role)
      && (
        dto.status !== undefined
        || dto.assignedToId !== undefined
        || dto.partnerId !== undefined
        || dto.slaDeadline !== undefined
      )
    ) {
      throw new ForbiddenException('Parceiros podem editar apenas assunto, categoria e prioridade');
    }
    if (dto.partnerId && dto.partnerId !== existing.partnerId) {
      throw new BadRequestException('O parceiro do chamado não pode ser alterado');
    }
    if (dto.status && dto.status !== existing.status) {
      this.assertStatusTransition(existing.status, dto.status);
    }
    if (dto.assignedToId) {
      await this.assertAssignableUser(dto.assignedToId);
    }
    const {
      partnerId: _partnerId,
      slaDeadline,
      ...updateData
    } = dto;
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...updateData,
        ...(slaDeadline && { slaDeadline: new Date(slaDeadline), slaNotifiedAt: null }),
        ...(dto.status
          && dto.status !== TicketStatus.RESOLVED
          && dto.status !== TicketStatus.CANCELLED
          ? { slaNotifiedAt: null }
          : {}),
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
    });

    if (dto.status && dto.status !== existing.status) {
      await this.addTimeline(id, 'Status alterado', existing.status, dto.status, user.id);
      if (dto.status === TicketStatus.RESOLVED) {
        await this.prisma.ticket.update({
          where: { id },
          data: { resolvedAt: new Date() },
        });
      } else if (existing.status === TicketStatus.RESOLVED) {
        await this.prisma.ticket.update({
          where: { id },
          data: { resolvedAt: null },
        });
      }
      if (existing.partnerId && isAdminRole(user.role)) {
        await this.notificationsService.createForPartnerUsers(existing.partnerId, {
          type: 'TICKET_REPLY',
          title: 'Andamento do chamado',
          message: `O chamado ${existing.protocol} agora está ${TICKET_STATUS_MESSAGES[dto.status].toLowerCase()}.`,
          data: { ticketId: id },
        }, [user.id]);
      }
    }

    if (existing.partnerId) {
      this.eventsGateway.emitToPartner(existing.partnerId, 'ticket:updated', ticket);
    }
    return ticket;
  }

  async updateStatus(id: string, dto: UpdateTicketStatusDto, user: AuthUser) {
    return this.update(id, dto, user);
  }

  async acknowledge(id: string, user: AuthUser) {
    if (!isAdminRole(user.role)) {
      throw new NotFoundException(MESSAGES.NOT_FOUND);
    }
    const ticket = await this.findOne(id, user);
    if (ticket.status !== TicketStatus.NEW) return ticket;

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.IN_PROGRESS },
      include: {
        assignedTo: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
    });
    await this.addTimeline(
      id,
      'Chamado visualizado pelo atendimento',
      TicketStatus.NEW,
      TicketStatus.IN_PROGRESS,
      user.id,
    );
    if (ticket.partnerId) {
      await this.notificationsService.createForPartnerUsers(ticket.partnerId, {
        type: 'TICKET_REPLY',
        title: 'Chamado recebido',
        message: `O atendimento visualizou o chamado ${ticket.protocol}. Ele está em andamento.`,
        data: { ticketId: id },
      }, [user.id]);
      this.eventsGateway.emitToPartner(ticket.partnerId, 'ticket:updated', updated);
    }
    return updated;
  }

  async addMessage(id: string, dto: CreateTicketMessageDto, user: AuthUser) {
    const ticket = await this.findOne(id, user);

    if (dto.isInternal && !isAdminRole(user.role)) {
      dto.isInternal = false;
    }

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId: id,
        userId: user.id,
        content: dto.content,
        isInternal: dto.isInternal ?? false,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    await this.addTimeline(id, 'Mensagem adicionada', null, null, user.id);

    if (!message.isInternal) {
      if (isAdminRole(user.role) && ticket.partnerId) {
        await this.notificationsService.createForPartnerUsers(ticket.partnerId, {
          type: 'TICKET_REPLY',
          title: 'Nova resposta no ticket',
          message: `Ticket ${ticket.protocol}: nova mensagem recebida.`,
          data: { ticketId: id },
        }, [user.id]);
      } else if (!isAdminRole(user.role)) {
        await this.notificationsService.createForAdminUsers({
          type: 'TICKET_REPLY',
          title: 'Nova mensagem de parceiro',
          message: `${user.name} respondeu ao chamado ${ticket.protocol}.`,
          data: { ticketId: id },
        }, [user.id]);
      }
      if (ticket.partnerId) {
        this.eventsGateway.emitToPartner(ticket.partnerId, 'ticket:message', message);
      }
    }

    return message;
  }

  async remove(id: string, user: AuthUser) {
    if (!isAdminRole(user.role)) {
      throw new ForbiddenException('Somente administradores podem excluir chamados');
    }
    const ticket = await this.findOne(id, user);
    await this.prisma.ticket.delete({ where: { id } });
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'tickets',
      entityId: id,
      entityType: 'Ticket',
    });
    if (ticket.partnerId) {
      this.eventsGateway.emitToPartner(ticket.partnerId, 'ticket:deleted', { id });
    }
    return { message: 'Ticket removido com sucesso' };
  }

  private async addTimeline(
    ticketId: string,
    action: string,
    fromStatus: TicketStatus | null,
    toStatus: TicketStatus | null,
    userId?: string,
    details?: string,
  ) {
    return this.prisma.ticketTimeline.create({
      data: { ticketId, action, fromStatus, toStatus, userId, details },
    });
  }

  listAssignees() {
    return this.prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.SUPERVISOR] },
        isActive: true,
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  async respond(id: string, dto: RespondTicketDto, user: AuthUser) {
    const ticket = await this.findOne(id, user);
    const content = dto.content?.trim();
    const statusChanged = Boolean(dto.status && dto.status !== ticket.status);
    if (!content && !statusChanged) {
      throw new BadRequestException('Informe uma mensagem ou uma alteração de status');
    }
    if (statusChanged && !isAdminRole(user.role)) {
      throw new ForbiddenException('Somente o atendimento pode alterar o status');
    }
    if (statusChanged) {
      this.assertStatusTransition(ticket.status, dto.status!);
    }
    const isInternal = Boolean(dto.isInternal && isAdminRole(user.role));
    await this.prisma.$transaction(async (tx) => {
      if (statusChanged) {
        await tx.ticket.update({
          where: { id },
          data: {
            status: dto.status,
            resolvedAt: dto.status === TicketStatus.RESOLVED
              ? new Date()
              : ticket.status === TicketStatus.RESOLVED ? null : undefined,
            ...(dto.status !== TicketStatus.RESOLVED
              && dto.status !== TicketStatus.CANCELLED
              ? { slaNotifiedAt: null }
              : {}),
          },
        });
        await tx.ticketTimeline.create({
          data: {
            ticketId: id,
            action: 'Status alterado',
            fromStatus: ticket.status,
            toStatus: dto.status,
            userId: user.id,
          },
        });
      }
      if (content) {
        await tx.ticketMessage.create({
          data: { ticketId: id, userId: user.id, content, isInternal },
        });
        await tx.ticketTimeline.create({
          data: {
            ticketId: id,
            action: 'Mensagem adicionada',
            userId: user.id,
          },
        });
      }
    });

    if (!isInternal) {
      const statusText = statusChanged
        ? ` Status: ${TICKET_STATUS_MESSAGES[dto.status!]}.`
        : '';
      if (isAdminRole(user.role) && ticket.partnerId) {
        await this.notificationsService.createForPartnerUsers(ticket.partnerId, {
          type: 'TICKET_REPLY',
          title: 'Chamado atualizado',
          message: `${ticket.protocol} foi atualizado.${statusText}`,
          data: { ticketId: id },
        }, [user.id]);
      } else if (!isAdminRole(user.role)) {
        await this.notificationsService.createForAdminUsers({
          type: 'TICKET_REPLY',
          title: 'Resposta de parceiro',
          message: `${user.name} respondeu ao chamado ${ticket.protocol}.`,
          data: { ticketId: id },
        }, [user.id]);
      }
    }
    if (ticket.partnerId) {
      this.eventsGateway.emitToPartner(ticket.partnerId, 'ticket:updated', { id });
    }
    return this.findOne(id, user);
  }

  private assertStatusTransition(from: TicketStatus, to: TicketStatus) {
    if (!TICKET_STATUS_TRANSITIONS[from].includes(to)) {
      throw new BadRequestException(
        `Não é permitido alterar o chamado de ${TICKET_STATUS_MESSAGES[from]} para ${TICKET_STATUS_MESSAGES[to]}`,
      );
    }
  }

  private async assertAssignableUser(userId: string) {
    const target = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        role: { in: [UserRole.ADMIN, UserRole.SUPERVISOR] },
      },
      select: { id: true },
    });
    if (!target) {
      throw new BadRequestException('Responsável inválido para o chamado');
    }
  }

  private async notifyOverdueTickets() {
    const overdue = await this.prisma.ticket.findMany({
      where: {
        status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CANCELLED] },
        slaDeadline: { lt: new Date() },
        slaNotifiedAt: null,
      },
      select: { id: true, protocol: true, subject: true },
      take: 20,
    });
    for (const ticket of overdue) {
      const claimed = await this.prisma.ticket.updateMany({
        where: { id: ticket.id, slaNotifiedAt: null },
        data: { slaNotifiedAt: new Date() },
      });
      if (!claimed.count) continue;
      await this.notificationsService.createForAdminUsers({
        type: 'SYSTEM',
        title: 'Chamado com prazo vencido',
        message: `${ticket.protocol}: ${ticket.subject}`,
        data: { ticketId: ticket.id },
      });
    }
  }
}
