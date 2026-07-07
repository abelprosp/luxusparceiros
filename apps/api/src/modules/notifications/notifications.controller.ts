import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/notification.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@luxus/types';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificações do usuário' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('isRead') isRead?: string,
  ) {
    return this.notificationsService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      isRead: isRead === undefined ? undefined : isRead === 'true',
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
