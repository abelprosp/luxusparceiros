import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@ApiTags('Plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Get('available')
  @RequirePermissions(PERMISSIONS.PLANS_READ)
  @ApiOperation({ summary: 'Planos disponíveis para o parceiro logado' })
  findAvailable(
    @CurrentUser() user: AuthUser,
    @Query('operatorId') operatorId?: string,
  ) {
    return this.plansService.findAll(user, {
      page: 1,
      limit: 100,
      operatorId,
    });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PLANS_READ)
  @ApiOperation({ summary: 'Listar planos (filtrados por parceiro quando aplicável)' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('operatorId') operatorId?: string,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.plansService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 50,
      search: pagination.search,
      operatorId,
      partnerId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PLANS_READ)
  @ApiOperation({ summary: 'Obter plano por ID' })
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PLANS_WRITE)
  @ApiOperation({ summary: 'Criar plano' })
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthUser) {
    return this.plansService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PLANS_WRITE)
  @ApiOperation({ summary: 'Atualizar plano' })
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto, @CurrentUser() user: AuthUser) {
    return this.plansService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PLANS_WRITE)
  @ApiOperation({ summary: 'Remover plano' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.plansService.remove(id, user.id);
  }
}
