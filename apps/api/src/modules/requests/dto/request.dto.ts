import { OmitType, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus, RequestType } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class BulkDeleteRequestsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids: string[];
}

export class RequestFiltersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ enum: RequestType })
  @IsOptional()
  @IsEnum(RequestType)
  type?: RequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class RequestListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ enum: RequestType })
  @IsOptional()
  @IsEnum(RequestType)
  type?: RequestType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CreateRequestDto {
  @ApiProperty({ enum: RequestType })
  @IsEnum(RequestType)
  type: RequestType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Responsável ativo no Luxus Task' })
  @IsOptional()
  @IsUUID()
  taskResponsibleId?: string;

  @ApiPropertyOptional({ description: 'Cliente ativo cadastrado no Luxus Task' })
  @IsOptional()
  @IsUUID()
  taskClientId?: string;

  @ApiPropertyOptional({ description: 'Nome do cliente selecionado no Luxus Task' })
  @IsOptional()
  @IsString()
  taskClientName?: string;

  @ApiPropertyOptional({ description: 'Tipo do documento do novo cliente: pf ou pj' })
  @IsOptional()
  @IsString()
  taskClientDocumentType?: string;

  @ApiPropertyOptional({ description: 'CPF ou CNPJ do novo cliente' })
  @IsOptional()
  @IsString()
  taskClientDocument?: string;

  @ApiPropertyOptional({ description: 'Prazo da demanda no formato YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  taskDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  taskPriority?: boolean;
}

export class UpdateRequestDto extends PartialType(
  OmitType(
    CreateRequestDto,
    [
      'taskResponsibleId',
      'taskClientId',
      'taskClientName',
      'taskClientDocumentType',
      'taskClientDocument',
      'taskDeadline',
      'taskPriority',
    ] as const,
  ),
) {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolution?: string;
}

export class CreateRequestCommentDto {
  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  status: RequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolution?: string;
}

export class RespondRequestDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
