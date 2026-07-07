import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { SimCardsController } from './sim-cards.controller';
import { SimCardsService } from './sim-cards.service';

@Module({
  imports: [AuditModule],
  controllers: [SimCardsController],
  providers: [SimCardsService],
  exports: [SimCardsService],
})
export class SimCardsModule {}
