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
  RejectSaleDto,
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

  @Post(':id/finalize-after-task-approval')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Finalizar venda após aprovação do contrato no Luxus Task' })
  finalizeAfterTaskApproval(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.finalizeAfterTaskApproval(id, user);
  }

  @Post(':id/release-blank-contract')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Administrador libera contrato em branco para assinatura' })
  releaseBlankContract(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.releaseBlankContract(id, user);
  }

  @Post(':id/workflow-turn')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Altera a vez do fluxo entre Luxus Task, Parceiros e Parceiro' })
  setWorkflowTurn(
    @Param('id') id: string,
    @Body() body: { turn: 'luxus_task' | 'luxus_parceiros' | 'parceiro' },
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.setWorkflowTurn(id, body.turn, user);
  }

  @Post(':id/request-workflow-turn')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Solicita a vez do fluxo com justificativa' })
  requestWorkflowTurn(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.requestWorkflowTurn(id, body.reason || '', user);
  }

  @Post(':id/respond-workflow-turn')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Aceita ou recusa um pedido de vez' })
  respondWorkflowTurn(
    @Param('id') id: string,
    @Body() body: { accept?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.respondWorkflowTurn(id, Boolean(body.accept), user);
  }

  @Post(':id/submit-signed-contract')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Parceiro envia o contrato assinado para conferência' })
  submitSignedContract(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.submitSignedContract(id, user);
  }

  @Post(':id/approve-signed-contract')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Administrador aprova o contrato assinado e o devolve ao Luxus Task' })
  approveSignedContract(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.approveSignedContract(id, user);
  }

  @Post(':id/request-contract-correction')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Administrador devolve o contrato assinado para correção' })
  requestContractCorrection(
    @Param('id') id: string,
    @Body() dto: RequestContractCorrectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.salesService.requestContractCorrection(id, dto, user);
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
