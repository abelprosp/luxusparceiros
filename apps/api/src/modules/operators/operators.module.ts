import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { PlansModule } from '@/modules/plans/plans.module';
import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';

@Module({
  imports: [AuditModule, PlansModule],
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
