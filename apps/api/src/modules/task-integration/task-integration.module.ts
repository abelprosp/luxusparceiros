import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { CommissionsModule } from '@/modules/commissions/commissions.module';
import { TelefoniaIntakeModule } from '@/modules/telefonia-intake/telefonia-intake.module';
import { TaskIntegrationController } from './task-integration.controller';
import { TaskIntegrationGuard } from './task-integration.guard';
import { TaskIntegrationService } from './task-integration.service';

@Module({
  imports: [NotificationsModule, CommissionsModule, TelefoniaIntakeModule],
  controllers: [TaskIntegrationController],
  providers: [TaskIntegrationGuard, TaskIntegrationService],
  exports: [TaskIntegrationService],
})
export class TaskIntegrationModule {}
