import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@luxus/types';
import { Response } from 'express';
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

  @Get('task-integration/clients')
  @RequirePermissions(PERMISSIONS.REQUESTS_WRITE)
  listClients(@Query('search') search?: string) {
    return this.integration.listClients(search);
  }

  @Public()
  @UseGuards(TaskIntegrationGuard)
  @Post('integrations/luxus-task/callback')
  callback(@Body() dto: TaskDemandCallbackDto) {
    return this.integration.applyCallback(dto);
  }

  @Get('task-integration/sales/:saleId/attachments/:attachmentId')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  async taskSaleAttachment(
    @Param('saleId') saleId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ) {
    const file = await this.integration.downloadTaskAttachment(saleId, attachmentId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.buffer.length);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    response.end(file.buffer);
  }

  @Public()
  @UseGuards(TaskIntegrationGuard)
  @Get('integrations/luxus-task/sales/:saleId/documents/:documentId')
  async saleDocument(
    @Param('saleId') saleId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const file = await this.integration.getSaleDocument(saleId, documentId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.buffer.length));
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    response.end(file.buffer);
  }
}
