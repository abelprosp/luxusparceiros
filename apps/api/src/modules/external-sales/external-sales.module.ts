import { Module } from '@nestjs/common';
import { ExternalSalesController } from './external-sales.controller';
import { ExternalSalesGuard } from './external-sales.guard';
import { ExternalSalesService } from './external-sales.service';

@Module({
  controllers: [ExternalSalesController],
  providers: [ExternalSalesGuard, ExternalSalesService],
})
export class ExternalSalesModule {}
