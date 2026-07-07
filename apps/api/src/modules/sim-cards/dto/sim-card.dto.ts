import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineStatus } from '@prisma/client';

export class CreateSimCardDto {
  @ApiProperty()
  @IsString()
  iccid: string;

  @ApiProperty()
  @IsUUID()
  operatorId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSimCardDto extends PartialType(CreateSimCardDto) {
  @ApiPropertyOptional({ enum: LineStatus })
  @IsOptional()
  @IsEnum(LineStatus)
  status?: LineStatus;
}

export class TransferSimCardsDto {
  @ApiProperty()
  @IsUUID()
  partnerId: string;

  @ApiProperty({ type: [String] })
  @IsUUID('4', { each: true })
  simCardIds: string[];
}
