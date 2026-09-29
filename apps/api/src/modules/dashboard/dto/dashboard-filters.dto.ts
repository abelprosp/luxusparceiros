import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class DashboardFiltersDto {
  @ApiPropertyOptional({ description: 'Filtrar pela filial vinculada' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por parceiro' })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por UF do parceiro', example: 'SP' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;

  @ApiPropertyOptional({ description: 'Filtrar por campanha' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por operadora' })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @ApiPropertyOptional({
    description: 'Período das métricas de vendas',
    enum: ['month', '30d', '60d', 'all'],
    default: '30d',
  })
  @IsOptional()
  @IsIn(['month', '30d', '60d', 'all'])
  period?: 'month' | '30d' | '60d' | 'all';
}
