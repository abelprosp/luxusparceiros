import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionStatus } from '@prisma/client';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class ApproveCommissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

/** Confirmação de que o pagamento foi realizado fora da plataforma. */
export class PayCommissionDto {
  @ApiPropertyOptional({ description: 'Observações sobre a confirmação do pagamento' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CommissionsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CommissionStatus })
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnerId?: string;
}
