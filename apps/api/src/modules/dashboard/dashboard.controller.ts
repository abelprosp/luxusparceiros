import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@RequirePermissions(PERMISSIONS.DASHBOARD_READ)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Obter métricas do dashboard' })
  getMetrics(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getMetrics(user);
  }

  @Get('admin')
  @ApiOperation({ summary: 'Métricas administrativas' })
  getAdminMetrics(@Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getAdminMetrics(filters);
  }

  @Get('partner')
  @ApiOperation({ summary: 'Métricas do parceiro' })
  getPartnerMetrics(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getPartnerMetrics(user, branchId);
  }
}
