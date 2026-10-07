import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class HistoricalPartnerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(11)
  document: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  phone?: string;
}

export class HistoricalClientDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(11)
  document: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class HistoricalAttachmentDto {
  @ApiProperty()
  @IsUUID()
  taskAttachmentId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name: string;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  @IsString()
  @MaxLength(12_000_000)
  contentBase64: string;
}

export class ImportHistoricalSaleDto {
  @ApiProperty()
  @IsUUID()
  taskDemandId: string;

  @ApiProperty({ example: 'LUX-2026-01179' })
  @IsString()
  @MinLength(6)
  taskProtocol: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => HistoricalPartnerDto)
  partner: HistoricalPartnerDto;

  @ApiProperty({ description: 'Nome da filial na planilha, por exemplo Lami' })
  @IsString()
  @MinLength(2)
  branchName: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => HistoricalClientDto)
  client: HistoricalClientDto;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  lineNumber: string;

  @ApiProperty({ example: '10 GB' })
  @IsString()
  planName: string;

  @ApiProperty({ example: 'Vivo' })
  @IsString()
  operatorName: string;

  @ApiProperty()
  @IsNumber()
  value: number;

  @ApiProperty({ description: 'Data em que a demanda foi aberta no Luxus Task' })
  @IsDateString()
  soldAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  activatedAt?: string;

  @ApiProperty({ type: [HistoricalAttachmentDto] })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => HistoricalAttachmentDto)
  attachments: HistoricalAttachmentDto[];
}
