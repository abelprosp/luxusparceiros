import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class CreateLineDto {
  @ApiProperty()
  @IsString()
  number: string;

  @ApiProperty()
  @IsUUID()
  operatorId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  simCardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;
}

export class UpdateLineDto extends PartialType(CreateLineDto) {
  @ApiPropertyOptional({ enum: LineStatus })
  @IsOptional()
  @IsEnum(LineStatus)
  status?: LineStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class ReserveLineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;
}

export class LinesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LineStatus })
  @IsOptional()
  @IsEnum(LineStatus)
  status?: LineStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'Filtrar apenas estoque geral (sem parceiro)' })
  @IsOptional()
  @Type(() => Boolean)
  generalOnly?: boolean;
}
