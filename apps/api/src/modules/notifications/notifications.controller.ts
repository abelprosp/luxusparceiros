import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, UserRole } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, NotificationsQueryDto } from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificações do usuário' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationsQueryDto,
  ) {
    return this.notificationsService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      isRead: query.isRead,
    });
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marcar todas como lidas' })
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllAsRead(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter notificação por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.findOne(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Criar notificação (admin)' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  markAsRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markAsRead(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover notificação' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.remove(id, user);
  }
}
