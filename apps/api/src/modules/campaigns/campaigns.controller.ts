import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampaignStatus } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

@ApiTags('Campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CAMPAIGNS_READ)
  @ApiOperation({ summary: 'Listar campanhas' })
  findAll(@Query() pagination: PaginationDto, @Query('status') status?: CampaignStatus) {
    return this.campaignsService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      search: pagination.search,
      status,
    });
  }

  @Get(':id/metrics')
  @RequirePermissions(PERMISSIONS.CAMPAIGNS_READ)
  @ApiOperation({ summary: 'Métricas da campanha' })
  getMetrics(@Param('id') id: string) {
    return this.campaignsService.getMetrics(id);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CAMPAIGNS_READ)
  @ApiOperation({ summary: 'Obter campanha por ID' })
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CAMPAIGNS_WRITE)
  @ApiOperation({ summary: 'Criar campanha' })
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthUser) {
    return this.campaignsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CAMPAIGNS_WRITE)
  @ApiOperation({ summary: 'Atualizar campanha' })
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto, @CurrentUser() user: AuthUser) {
    return this.campaignsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CAMPAIGNS_WRITE)
  @ApiOperation({ summary: 'Remover campanha' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.campaignsService.remove(id, user.id);
  }
}
