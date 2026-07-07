import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { LinesService } from '@/modules/lines/lines.service';
import { LinesQueryDto, ReserveLineDto } from '@/modules/lines/dto/line.dto';
import { StockService } from './stock.service';
import { CreateStockMovementDto, ImportStockDto, StockMovementsQueryDto } from './dto/stock.dto';

@ApiTags('Stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(
    private stockService: StockService,
    private linesService: LinesService,
  ) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  @ApiOperation({ summary: 'Resumo do estoque' })
  getSummary(@CurrentUser() user: AuthUser) {
    return this.stockService.getSummary(user);
  }

  @Get('export')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  @ApiOperation({ summary: 'Exportar estoque em CSV' })
  async exportCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.stockService.exportCsv(user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="estoque.csv"');
    res.send(csv);
  }

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
      generalOnly: query.generalOnly,
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
    @Query() query: StockMovementsQueryDto,
  ) {
    return this.stockService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      type: query.type,
      partnerId: query.partnerId,
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        operatorId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportStockDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo CSV é obrigatório');
    }
    return this.stockService.importCsv(file.buffer.toString('utf-8'), user, dto.operatorId);
  }
}
