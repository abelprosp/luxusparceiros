import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartnerStatus } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { PartnersService } from './partners.service';
import {
  CreatePartnerDto,
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
  findAll(@Query() pagination: PaginationDto, @Query('status') status?: PartnerStatus) {
    return this.partnersService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      search: pagination.search,
      status,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PARTNERS_READ)
  @ApiOperation({ summary: 'Obter parceiro por ID' })
  findOne(@Param('id') id: string) {
    return this.partnersService.findOne(id);
  }

  @Get(':id/plans')
  @RequirePermissions(PERMISSIONS.PLANS_READ)
  @ApiOperation({ summary: 'Listar planos vinculados ao parceiro' })
  getPartnerPlans(@Param('id') id: string) {
    return this.partnersService.getPartnerPlans(id);
  }

  @Put(':id/plans')
  @RequirePermissions(PERMISSIONS.PLANS_WRITE)
  @ApiOperation({ summary: 'Vincular planos ao parceiro' })
  setPartnerPlans(
    @Param('id') id: string,
    @Body() dto: SetPartnerPlansDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.partnersService.setPartnerPlans(id, dto, user.id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Criar parceiro (com usuário opcional)' })
  create(@Body() dto: CreatePartnerDto, @CurrentUser() user: AuthUser) {
    return this.partnersService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Atualizar parceiro' })
  update(@Param('id') id: string, @Body() dto: UpdatePartnerDto, @CurrentUser() user: AuthUser) {
    return this.partnersService.update(id, dto, user.id);
  }

  @Post(':id/reset-password')
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Redefinir senha do usuário parceiro' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPartnerPasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.partnersService.resetPassword(id, dto, user.id);
  }

  @Post(':id/suspend')
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Suspender parceiro' })
  suspend(@Param('id') id: string, @Body() dto: SuspendPartnerDto, @CurrentUser() user: AuthUser) {
    return this.partnersService.suspend(id, dto, user.id);
  }

  @Post(':id/activate')
  @RequirePermissions(PERMISSIONS.PARTNERS_WRITE)
  @ApiOperation({ summary: 'Reativar parceiro' })
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.partnersService.activate(id, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PARTNERS_DELETE)
  @ApiOperation({ summary: 'Remover parceiro' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.partnersService.remove(id, user.id);
  }
}
