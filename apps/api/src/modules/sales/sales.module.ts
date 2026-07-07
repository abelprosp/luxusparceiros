import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { CommissionsModule } from '@/modules/commissions/commissions.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { PlansModule } from '@/modules/plans/plans.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    AuditModule,
    forwardRef(() => CommissionsModule),
    NotificationsModule,
    PlansModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
