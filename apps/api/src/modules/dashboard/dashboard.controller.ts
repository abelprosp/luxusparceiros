import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS, UserRole } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
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
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.FINANCIAL)
  @ApiOperation({ summary: 'Métricas administrativas' })
  getAdminMetrics(@CurrentUser() user: AuthUser, @Query() filters: DashboardFiltersDto) {
    return this.dashboardService.getAdminMetrics({
      ...filters,
      ...(user.partnerId && { partnerId: user.partnerId }),
    });
  }

  @Get('partner')
  @ApiOperation({ summary: 'Métricas do parceiro' })
  getPartnerMetrics(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getPartnerMetrics(user, branchId);
  }

  @Get('details')
  @ApiOperation({ summary: 'Detalhes e dados exportáveis do dashboard' })
  getDetails(
    @CurrentUser() user: AuthUser,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboardService.getDetails(
      user,
      {
        ...filters,
        ...(user.partnerId && { partnerId: user.partnerId }),
      },
      filters.branchId,
    );
  }
}
