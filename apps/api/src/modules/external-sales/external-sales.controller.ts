import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ExternalSalesQueryDto } from './dto/external-sales.dto';
import { ImportHistoricalSaleDto } from './dto/import-historical-sale.dto';
import { ExternalSalesGuard } from './external-sales.guard';
import { ExternalSalesService } from './external-sales.service';
import { HistoricalSalesService } from './historical-sales.service';

@ApiTags('Integração — consulta de vendas')
@ApiHeader({
  name: 'x-api-key',
  description: 'Chave da API externa (EXTERNAL_SALES_API_KEY)',
  required: true,
})
@Public()
@UseGuards(ExternalSalesGuard)
@Controller('integrations/external/sales')
export class ExternalSalesController {
  constructor(
    private readonly externalSales: ExternalSalesService,
    private readonly historicalSales: HistoricalSalesService,
  ) {}

  @Post('historical')
  @ApiOperation({
    summary: 'Copiar uma demanda já existente do Luxus Task',
    description:
      'Grava a venda, o cliente e, se faltarem, o parceiro e a filial. Não cria demanda e não altera o status no Luxus Task.',
  })
  importHistorical(@Body() dto: ImportHistoricalSaleDto) {
    return this.historicalSales.importOne(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar vendas de parceiros',
    description:
      'Consulta paginada de vendas para sistemas terceiros. Autenticação via header x-api-key.',
  })
  list(@Query() query: ExternalSalesQueryDto) {
    return this.externalSales.findAll(query);
  }

  @Get(':idOrProtocol')
  @ApiOperation({
    summary: 'Detalhe de uma venda',
    description: 'Busca por UUID da venda ou pelo protocolo.',
  })
  getOne(@Param('idOrProtocol') idOrProtocol: string) {
    return this.externalSales.findOne(idOrProtocol);
  }
}
