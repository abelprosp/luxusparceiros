import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus, Prisma } from '@prisma/client';
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
  UpdateTicketDto,
  UpdateTicketStatusDto,
} from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private eventsGateway: EventsGateway,
  ) {}

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
        category: dto.category,
        priority: dto.priority,
        partnerId: partnerId ?? null,
        createdById: user.id,
        slaDeadline,
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
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: dto,
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

    if (ticket.partnerId) {
      if (!message.isInternal) {
        await this.notificationsService.createForPartnerUsers(ticket.partnerId, {
          type: 'TICKET_REPLY',
          title: 'Nova resposta no ticket',
          message: `Ticket ${ticket.protocol}: nova mensagem recebida.`,
          data: { ticketId: id },
        });
        this.eventsGateway.emitToPartner(ticket.partnerId, 'ticket:message', message);
      }
    }

    return message;
  }

  async remove(id: string, user: AuthUser) {
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
}
