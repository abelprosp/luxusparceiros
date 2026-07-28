import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@luxus/types';
import { Public } from '@/common/decorators/public.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { TaskDemandCallbackDto } from './dto/task-integration.dto';
import { TaskIntegrationGuard } from './task-integration.guard';
import { TaskIntegrationService } from './task-integration.service';

@Controller()
export class TaskIntegrationController {
  constructor(private readonly integration: TaskIntegrationService) {}

  @Get('task-integration/responsibles')
  @RequirePermissions(PERMISSIONS.REQUESTS_WRITE)
  listResponsibles() {
    return this.integration.listResponsibles();
  }

  @Public()
  @UseGuards(TaskIntegrationGuard)
  @Post('integrations/luxus-task/callback')
  callback(@Body() dto: TaskDemandCallbackDto) {
    return this.integration.applyCallback(dto);
  }
}
