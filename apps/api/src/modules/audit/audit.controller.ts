import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { AuditService } from './audit.service';

class AuditQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;
}

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@RequirePermissions(PERMISSIONS.AUDIT_READ)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Listar logs de auditoria' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: AuditQueryDto,
  ) {
    return this.auditService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      module: query.module,
      userId: query.userId,
      action: query.action,
    });
  }
}
