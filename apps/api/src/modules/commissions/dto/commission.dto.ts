import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
