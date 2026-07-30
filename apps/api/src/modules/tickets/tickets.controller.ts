import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TicketStatus } from '@prisma/client';
import { AuthUser, PERMISSIONS, UserRole } from '@luxus/types';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  CreateTicketMessageDto,
  RespondTicketDto,
  UpdateTicketDto,
  UpdateTicketStatusDto,
} from './dto/ticket.dto';

class TicketQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsUUID()
  partnerId?: string;
}

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TICKETS_READ)
  @ApiOperation({ summary: 'Listar tickets' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: TicketQueryDto,
  ) {
    return this.ticketsService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      status: query.status,
      partnerId: query.partnerId,
    });
  }

  @Get('kanban')
  @RequirePermissions(PERMISSIONS.TICKETS_READ)
  @ApiOperation({ summary: 'Visualização kanban dos tickets' })
  kanban(@CurrentUser() user: AuthUser, @Query('partnerId') partnerId?: string) {
    return this.ticketsService.getKanban(user, partnerId);
  }

  @Get('assignees')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Listar responsáveis disponíveis para chamados' })
  assignees() {
    return this.ticketsService.listAssignees();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TICKETS_READ)
  @ApiOperation({ summary: 'Obter ticket por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Criar ticket' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Atualizar ticket' })
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto, @CurrentUser() user: AuthUser) {
    return this.ticketsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Atualizar status do ticket (kanban)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.updateStatus(id, dto, user);
  }

  @Patch(':id/acknowledge')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Registrar que o atendimento visualizou o ticket' })
  acknowledge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.acknowledge(id, user);
  }

  @Post(':id/messages')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Adicionar mensagem ao ticket' })
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.addMessage(id, dto, user);
  }

  @Post(':id/respond')
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Salvar status e mensagem em uma única operação' })
  respond(
    @Param('id') id: string,
    @Body() dto: RespondTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ticketsService.respond(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @RequirePermissions(PERMISSIONS.TICKETS_WRITE)
  @ApiOperation({ summary: 'Remover ticket' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ticketsService.remove(id, user);
  }
}
