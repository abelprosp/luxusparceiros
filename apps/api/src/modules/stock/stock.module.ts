import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { LinesModule } from '@/modules/lines/lines.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [AuditModule, LinesModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
