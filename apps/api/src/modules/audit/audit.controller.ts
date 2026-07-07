import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { PERMISSIONS } from '@luxus/types';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@RequirePermissions(PERMISSIONS.AUDIT_READ)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Listar logs de auditoria' })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('module') module?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
  ) {
    return this.auditService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      module,
      userId,
      action,
    });
  }
}
