import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommissionStatus } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CommissionsService } from './commissions.service';
import { ApproveCommissionDto, PayCommissionDto } from './dto/commission.dto';

@ApiTags('Commissions')
@ApiBearerAuth()
@Controller('commissions')
export class CommissionsController {
  constructor(private commissionsService: CommissionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.COMMISSIONS_READ)
  @ApiOperation({ summary: 'Listar comissões' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('status') status?: CommissionStatus,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.commissionsService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      status,
      partnerId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.COMMISSIONS_READ)
  @ApiOperation({ summary: 'Obter comissão por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.commissionsService.findOne(id, user);
  }

  @Post(':id/approve')
  @RequirePermissions(PERMISSIONS.COMMISSIONS_APPROVE)
  @ApiOperation({ summary: 'Aprovar comissão' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveCommissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commissionsService.approve(id, dto, user);
  }

  @Post(':id/pay')
  @RequirePermissions(PERMISSIONS.COMMISSIONS_APPROVE)
  @ApiOperation({ summary: 'Confirmar pagamento da comissão (realizado fora da plataforma)' })
  pay(@Param('id') id: string, @Body() dto: PayCommissionDto, @CurrentUser() user: AuthUser) {
    return this.commissionsService.pay(id, dto, user);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.COMMISSIONS_WRITE)
  @ApiOperation({ summary: 'Cancelar comissão' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.commissionsService.cancel(id, user);
  }
}
