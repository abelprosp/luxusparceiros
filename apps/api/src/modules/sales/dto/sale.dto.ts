import { PartialType } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractFormat, DocumentType, DonorOperator, SaleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CreateClientInlineDto } from './create-client-inline.dto';

export class BulkDeleteSalesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class SaleRequiredDocumentDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fulfilled?: boolean;
}

export class CreateSaleDto {
  @ApiPropertyOptional()
  @ValidateIf((o) => !o.client)
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.clientId)
  @ValidateNested()
  @Type(() => CreateClientInlineDto)
  client?: CreateClientInlineDto;

  @ApiProperty()
  @IsUUID()
  operatorId: string;

  @ApiProperty()
  @IsUUID()
  planId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  lineId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPortability?: boolean;

  @ApiPropertyOptional({ description: 'Número a ser portado' })
  @ValidateIf((o) => o.isPortability === true)
  @IsString()
  @IsNotEmpty()
  portabilityNumber?: string;

  @ApiPropertyOptional({ enum: DonorOperator, description: 'Operadora doadora da linha' })
  @ValidateIf((o) => o.isPortability === true)
  @IsEnum(DonorOperator)
  donorOperator?: DonorOperator;

  @ApiPropertyOptional({ description: 'Número da linha vendida' })
  @IsOptional()
  @IsString()
  newNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVirginChip?: boolean;

  @ApiPropertyOptional({ description: 'ICCID do chip vendido (obrigatório se chip virgem)' })
  @IsOptional()
  @IsString()
  chipIccid?: string;

  @ApiProperty({ enum: ContractFormat, description: 'Formato que o Luxus Task usará para obter a assinatura' })
  @IsEnum(ContractFormat)
  contractFormat: ContractFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSaleDto extends PartialType(CreateSaleDto) {}

export class UpdateSaleStatusDto {
  @ApiProperty({ enum: SaleStatus })
  @IsEnum(SaleStatus)
  status: SaleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contestReason?: string;
}

export class RequestSaleDocumentsDto {
  @ApiProperty({ type: [SaleRequiredDocumentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleRequiredDocumentDto)
  documents: SaleRequiredDocumentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

export class ContestSaleDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class RejectSaleDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class RequestSaleCorrectionDto {
  @ApiProperty({ description: 'Orientação visível ao parceiro sobre o que deve ser corrigido' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RequestContractCorrectionDto {
  @ApiProperty({ description: 'Motivo da correção do contrato assinado' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ApproveSaleForTaskDto {
  @ApiProperty()
  @IsUUID()
  responsibleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ enum: ['pf', 'pj'] })
  @IsOptional()
  @IsIn(['pf', 'pj'])
  clientDocumentType?: 'pf' | 'pj';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientDocument?: string;

  @ApiProperty()
  @IsDateString()
  deadline: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  priority?: boolean;

  @ApiPropertyOptional({ description: 'Complemento interno enviado ao Luxus Task' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SalesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SaleStatus })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}
