import { Module } from '@nestjs/common';
import { TaskIntegrationController } from './task-integration.controller';
import { TaskIntegrationGuard } from './task-integration.guard';
import { TaskIntegrationService } from './task-integration.service';

@Module({
  controllers: [TaskIntegrationController],
  providers: [TaskIntegrationGuard, TaskIntegrationService],
  exports: [TaskIntegrationService],
})
export class TaskIntegrationModule {}
