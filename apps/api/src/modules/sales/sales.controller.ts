import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { SalesService } from './sales.service';
import {
  ContestSaleDto,
  CreateSaleDto,
  RejectSaleDto,
  RequestSaleDocumentsDto,
  SalesQueryDto,
  UpdateSaleDto,
  UpdateSaleStatusDto,
} from './dto/sale.dto';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private salesService: SalesService) {}

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

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SALES_DELETE)
  @ApiOperation({ summary: 'Remover venda' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.salesService.remove(id, user);
  }
}
