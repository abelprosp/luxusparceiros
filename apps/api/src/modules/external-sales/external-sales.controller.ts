import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ExternalSalesQueryDto } from './dto/external-sales.dto';
import { ExternalSalesGuard } from './external-sales.guard';
import { ExternalSalesService } from './external-sales.service';

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
  constructor(private readonly externalSales: ExternalSalesService) {}

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
