import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PartnersService } from './partners.service';
import {
  CreatePartnerDto,
  PartnersQueryDto,
  ResetPartnerPasswordDto,
  SetPartnerPlansDto,
  SuspendPartnerDto,
  UpdatePartnerDto,
} from './dto/partner.dto';

@ApiTags('Partners')
@ApiBearerAuth()
@Controller('partners')
export class PartnersController {
  constructor(private partnersService: PartnersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PARTNERS_READ)
  @ApiOperation({ summary: 'Listar parceiros' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: PartnersQueryDto) {
    return this.partnersService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      status: query.status,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PARTNERS_READ)
  @ApiOperation({ summary: 'Obter parceiro por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.partnersService.findOne(id, user);
  }

  @Get(':id/plans')
  @RequirePermissions(PERMISSIONS.PLANS_READ)
  @ApiOperation({ summary: 'Listar planos vinculados ao parceiro' })
  getPartnerPlans(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.partnersService.getPartnerPlans(id, user);
  }

  @Put(':id/plans')
  @RequirePermissions(PERMISSIONS.PLANS_WRITE)
  @ApiOperation({ summary: 'Vincular planos ao parceiro' })
  setPartnerPlans(
    @Param('id') id: string,
    @Body() dto: SetPartnerPlansDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.partnersService.setPartnerPlans(id, dto, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Criar parceiro (com usuário opcional)' })
  create(@Body() dto: CreatePartnerDto, @CurrentUser() user: AuthUser) {
    return this.partnersService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Atualizar parceiro' })
  update(@Param('id') id: string, @Body() dto: UpdatePartnerDto, @CurrentUser() user: AuthUser) {
    return this.partnersService.update(id, dto, user);
  }

  @Post(':id/reset-password')
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Redefinir senha do usuário parceiro' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPartnerPasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.partnersService.resetPassword(id, dto, user);
  }

  @Post(':id/suspend')
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Suspender parceiro' })
  suspend(@Param('id') id: string, @Body() dto: SuspendPartnerDto, @CurrentUser() user: AuthUser) {
    return this.partnersService.suspend(id, dto, user);
  }

  @Post(':id/activate')
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Reativar parceiro' })
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.partnersService.activate(id, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PARTNERS_DELETE)
  @ApiOperation({ summary: 'Remover parceiro' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.partnersService.remove(id, user);
  }
}
