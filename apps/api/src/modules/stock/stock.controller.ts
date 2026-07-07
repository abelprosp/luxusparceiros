import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { LinesService } from '@/modules/lines/lines.service';
import { LinesQueryDto, ReserveLineDto } from '@/modules/lines/dto/line.dto';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/stock.dto';

@ApiTags('Stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(
    private stockService: StockService,
    private linesService: LinesService,
  ) {}

  @Get('lines')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  @ApiOperation({ summary: 'Listar linhas do estoque do parceiro' })
  findLines(@CurrentUser() user: AuthUser, @Query() query: LinesQueryDto) {
    return this.linesService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      search: query.search,
      status: query.status,
      partnerId: query.partnerId,
    });
  }

  @Post('lines/:id/reserve')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  @ApiOperation({ summary: 'Reservar linha do estoque' })
  reserveLine(
    @Param('id') id: string,
    @Body() dto: ReserveLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.linesService.reserve(id, dto, user);
  }

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
