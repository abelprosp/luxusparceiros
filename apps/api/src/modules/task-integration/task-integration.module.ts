import { Module } from '@nestjs/common';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { TaskIntegrationController } from './task-integration.controller';
import { TaskIntegrationGuard } from './task-integration.guard';
import { TaskIntegrationService } from './task-integration.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TaskIntegrationController],
  providers: [TaskIntegrationGuard, TaskIntegrationService],
  exports: [TaskIntegrationService],
})
export class TaskIntegrationModule {}
