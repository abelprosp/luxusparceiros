import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { SalesService } from './sales.service';
import {
  ContestSaleDto,
  BulkDeleteSalesDto,
  ApproveSaleForTaskDto,
  CreateSaleDto,
  ForceFinalizeSaleDto,
  RejectSaleDto,
  ReopenSaleDto,
  RequestSaleDocumentsDto,
  RequestSaleCorrectionDto,
  RequestContractCorrectionDto,
  SalesQueryDto,
  UpdateSaleDto,
  UpdateSaleStatusDto,
} from './dto/sale.dto';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Post('bulk-delete')
  @RequirePermissions(PERMISSIONS.SALES_DELETE)
  @ApiOperation({ summary: 'Excluir vendas selecionadas em lote' })
  bulkDelete(@Body() dto: BulkDeleteSalesDto, @CurrentUser() user: AuthUser) {
    return this.salesService.bulkRemove(dto.ids, user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Listar vendas' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: SalesQueryDto,
  ) {
    return this.salesService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      status: query.status,
      partnerId: query.partnerId,
      branchId: query.branchId,
      campaignId: query.campaignId,
      turn: query.turn,
      syncError: query.syncError,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Obter venda por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Criar venda' })
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: AuthUser) {
    return this.salesService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Atualizar venda' })
  update(@Param('id') id: string, @Body() dto: UpdateSaleDto, @CurrentUser() user: AuthUser) {
    return this.salesService.update(id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Atualizar status da venda' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSaleStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.updateStatus(id, dto, user);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Aprovar venda' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.approve(id, user);
  }

  @Post(':id/submit')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Enviar ou reenviar venda para análise do administrador' })
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.submitForReview(id, user);
  }

  @Post(':id/start-review')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Registrar início da análise da venda' })
  startReview(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.startReview(id, user);
  }

  @Post(':id/request-correction')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Devolver venda ao parceiro para correção' })
  requestCorrection(
    @Param('id') id: string,
    @Body() dto: RequestSaleCorrectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.requestCorrection(id, dto, user);
  }

  @Post(':id/approve-for-task')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Aprovar revisão e enfileirar venda para o Luxus Task' })
  approveForTask(
    @Param('id') id: string,
    @Body() dto: ApproveSaleForTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.approveForTask(id, dto, user);
  }

  @Post(':id/approve-internal')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Aprovar e concluir a venda no Luxus Parceiros sem enviar ao Luxus Task' })
  approveInternal(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.approveInternal(id, user);
  }

  @Post(':id/retry-task-sync')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Tentar novamente o envio da venda ao Luxus Task' })
  retryTaskSync(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.retryTaskSync(id, user);
  }

  @Post(':id/refresh-task-status')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Atualizar etapa e presença do responsável no Luxus Task' })
  refreshTaskStatus(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.refreshTaskStatus(id, user);
  }

  @Post(':id/force-finalize')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Finalizar venda local que nunca foi enviada ao Luxus Task' })
  forceFinalize(
    @Param('id') id: string,
    @Body() dto: ForceFinalizeSaleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.forceFinalize(id, user, dto.reason);
  }

  @Post(':id/reopen')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Reabrir venda concluída para correção de erro' })
  reopen(
    @Param('id') id: string,
    @Body() dto: ReopenSaleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.reopen(id, user, dto.reason);
  }

  @Post(':id/reject')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Rejeitar venda' })
  reject(@Param('id') id: string, @Body() dto: RejectSaleDto, @CurrentUser() user: AuthUser) {
    return this.salesService.reject(id, dto, user);
  }

  @Post(':id/contest')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Contestar venda' })
  contest(@Param('id') id: string, @Body() dto: ContestSaleDto, @CurrentUser() user: AuthUser) {
    return this.salesService.contest(id, dto, user);
  }

  @Post(':id/request-documents')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Solicitar documentos da venda' })
  requestDocuments(
    @Param('id') id: string,
    @Body() dto: RequestSaleDocumentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.requestDocuments(id, dto, user);
  }

  @Post(':id/resubmit-documents')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Parceiro reenvia documentos solicitados' })
  resubmitDocuments(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.resubmitDocuments(id, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SALES_DELETE)
  @ApiOperation({ summary: 'Remover venda' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.remove(id, user);
  }
}
