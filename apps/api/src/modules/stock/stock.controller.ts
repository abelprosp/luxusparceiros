import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/stock.dto';

@ApiTags('Stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private stockService: StockService) {}

  @Get('movements')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  @ApiOperation({ summary: 'Listar movimentações de estoque' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('type') type?: StockMovementType,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.stockService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      type,
      partnerId,
    });
  }

  @Post('movements')
  @RequirePermissions(PERMISSIONS.STOCK_WRITE)
  @ApiOperation({ summary: 'Registrar movimentação de estoque' })
  create(@Body() dto: CreateStockMovementDto, @CurrentUser() user: AuthUser) {
    return this.stockService.create(dto, user);
  }

  @Post('import')
  @RequirePermissions(PERMISSIONS.STOCK_WRITE)
  @ApiOperation({ summary: 'Importar estoque via CSV' })
  importCsv(
    @Body('csv') csv: string,
    @CurrentUser() user: AuthUser,
    @Body('operatorId') operatorId?: string,
  ) {
    return this.stockService.importCsv(csv, user, operatorId);
  }
}
