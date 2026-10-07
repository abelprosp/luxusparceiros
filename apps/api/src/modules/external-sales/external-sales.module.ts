import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { ExternalSalesController } from './external-sales.controller';
import { ExternalSalesGuard } from './external-sales.guard';
import { ExternalSalesService } from './external-sales.service';
import { HistoricalSalesService } from './historical-sales.service';

@Module({
  imports: [AuditModule],
  controllers: [ExternalSalesController],
  providers: [ExternalSalesGuard, ExternalSalesService, HistoricalSalesService],
})
export class ExternalSalesModule {}
