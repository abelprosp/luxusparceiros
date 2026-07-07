import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsUUID()
  operatorId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Compatibilidade: percentual legado' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commission?: number;

  @ApiPropertyOptional({ enum: CommissionType, default: CommissionType.PERCENTAGE })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @ApiPropertyOptional({ description: 'Percentual ou valor fixo conforme commissionType' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commissionValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataFranchise?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  speed?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
