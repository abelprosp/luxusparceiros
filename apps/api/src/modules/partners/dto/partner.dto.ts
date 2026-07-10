import { PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType, PartnerStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class CreatePartnerUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreatePartnerDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiProperty()
  @IsString()
  document: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commissionRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  goal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  goalMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(2, 2)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(/^\d{8}$/, { message: 'CEP deve conter 8 dígitos' })
  zipCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAgency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pixKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pixKeyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: CreatePartnerUserDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePartnerUserDto)
  user?: CreatePartnerUserDto;
}

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {
  @ApiPropertyOptional({ enum: PartnerStatus })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus;
}

export class SuspendPartnerDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class PartnerPlanItemDto {
  @ApiProperty()
  @IsString()
  planId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customCommission?: number;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

export class SetPartnerPlansDto {
  @ApiProperty({ type: [PartnerPlanItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerPlanItemDto)
  plans: PartnerPlanItemDto[];
}

export class ResetPartnerPasswordDto {
  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}

export class PartnersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PartnerStatus })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus;
}
