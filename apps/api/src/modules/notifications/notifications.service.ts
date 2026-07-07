import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { EventsGateway } from '@/gateway/events.gateway';
import { MESSAGES } from '@/common/constants/messages';
import { CreateNotificationDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async findAll(user: AuthUser, params: { page: number; limit: number; isRead?: boolean }) {
    const where: Prisma.NotificationWhereInput = { userId: user.id };
    if (params.isRead !== undefined) where.isRead = params.isRead;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });

    return {
      data,
      unreadCount,
      meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!notification) throw new NotFoundException(MESSAGES.NOT_FOUND);
    return notification;
  }

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data as Prisma.InputJsonValue,
      },
    });
    this.eventsGateway.emitToUser(dto.userId, 'notification:new', notification);
    this.eventsGateway.emitToUser(dto.userId, 'notification', notification);
    return notification;
  }

  async createForPartnerUsers(
    partnerId: string,
    data: { type: NotificationType; title: string; message: string; data?: Record<string, unknown> },
  ) {
    const users = await this.prisma.user.findMany({
      where: { partnerId, isActive: true, notificationsEnabled: true },
      select: { id: true },
    });

    const notifications = await Promise.all(
      users.map((u) =>
        this.create({
          userId: u.id,
          type: data.type,
          title: data.title,
          message: data.message,
          data: data.data,
        }),
      ),
    );

    return notifications;
  }

  async markAsRead(id: string, user: AuthUser) {
    await this.findOne(id, user);
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    this.eventsGateway.emitToUser(user.id, 'notification:read', { id });
    return updated;
  }

  async markAllAsRead(user: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    this.eventsGateway.emitToUser(user.id, 'notification:read-all', { updated: result.count });
    return { updated: result.count };
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notificação removida com sucesso' };
  }
}
