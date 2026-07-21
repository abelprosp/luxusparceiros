import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PlansService } from './plans.service';
import { CreatePlanDto, PlansQueryDto, UpdatePlanDto } from './dto/plan.dto';

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
    @Query() query: PlansQueryDto,
  ) {
    return this.plansService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      search: query.search,
      operatorId: query.operatorId,
      partnerId: query.partnerId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PLANS_READ)
  @ApiOperation({ summary: 'Obter plano por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.plansService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PLANS_WRITE)
  @ApiOperation({ summary: 'Criar plano' })
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthUser) {
    this.assertPlatformAdmin(user);
    return this.plansService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PLANS_WRITE)
  @ApiOperation({ summary: 'Atualizar plano' })
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto, @CurrentUser() user: AuthUser) {
    this.assertPlatformAdmin(user);
    return this.plansService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PLANS_WRITE)
  @ApiOperation({ summary: 'Remover plano' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertPlatformAdmin(user);
    return this.plansService.remove(id, user.id);
  }

  private assertPlatformAdmin(user: AuthUser) {
    if (user.partnerId) {
      throw new ForbiddenException('O catálogo de planos só pode ser alterado pela administração da plataforma');
    }
  }
}
