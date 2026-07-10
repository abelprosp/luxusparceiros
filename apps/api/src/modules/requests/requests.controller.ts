import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { RequestsService } from './requests.service';
import {
  CreateRequestCommentDto,
  CreateRequestDto,
  RequestFiltersDto,
  RequestListQueryDto,
  UpdateRequestDto,
  UpdateRequestStatusDto,
} from './dto/request.dto';

@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private requestsService: RequestsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REQUESTS_READ)
  @ApiOperation({ summary: 'Listar solicitações' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: RequestListQueryDto,
  ) {
    return this.requestsService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      status: query.status,
      type: query.type,
      partnerId: query.partnerId,
      branchId: query.branchId,
    });
  }

  @Get('kanban')
  @RequirePermissions(PERMISSIONS.REQUESTS_READ)
  @ApiOperation({ summary: 'Listar solicitações agrupadas para o Kanban' })
  findKanban(
    @CurrentUser() user: AuthUser,
    @Query() query: RequestFiltersDto,
  ) {
    return this.requestsService.findKanban(user, {
      search: query.search,
      status: query.status,
      type: query.type,
      partnerId: query.partnerId,
      branchId: query.branchId,
    });
  }

  @Get('export/csv')
  @RequirePermissions(PERMISSIONS.REQUESTS_READ)
  @ApiOperation({ summary: 'Exportar solicitações em CSV' })
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query() query: RequestFiltersDto,
  ) {
    const csv = await this.requestsService.exportCsv(user, {
      search: query.search,
      status: query.status,
      type: query.type,
      partnerId: query.partnerId,
      branchId: query.branchId,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=solicitacoes.csv');
    res.send(csv);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.REQUESTS_READ)
  @ApiOperation({ summary: 'Obter solicitação por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.requestsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.REQUESTS_WRITE)
  @ApiOperation({ summary: 'Criar solicitação' })
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requestsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.REQUESTS_WRITE)
  @ApiOperation({ summary: 'Atualizar solicitação' })
  update(@Param('id') id: string, @Body() dto: UpdateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requestsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.REQUESTS_WRITE)
  @ApiOperation({ summary: 'Atualizar status da solicitação' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.updateStatus(id, dto, user);
  }

  @Post(':id/comments')
  @RequirePermissions(PERMISSIONS.REQUESTS_WRITE)
  @ApiOperation({ summary: 'Adicionar comentário' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateRequestCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requestsService.addComment(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.REQUESTS_WRITE)
  @ApiOperation({ summary: 'Remover solicitação' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.requestsService.remove(id, user);
  }
}
