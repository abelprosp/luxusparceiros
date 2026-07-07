import { Body, Controller, Delete, Get, Param, Patch, Post, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BranchStatus } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private branchesService: BranchesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BRANCHES_READ)
  @ApiOperation({ summary: 'Listar filiais' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('partnerId') partnerId?: string,
    @Query('status') status?: BranchStatus,
  ) {
    return this.branchesService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      search: pagination.search,
      partnerId,
      status,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.BRANCHES_READ)
  @ApiOperation({ summary: 'Obter filial por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.branchesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BRANCHES_WRITE)
  @ApiOperation({ summary: 'Criar filial (parceiro logado)' })
  createForCurrentPartner(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!user.partnerId) {
      throw new ForbiddenException('Usuário sem parceiro vinculado');
    }
    return this.branchesService.create(user.partnerId, dto, user);
  }

  @Post('partner/:partnerId')
  @RequirePermissions(PERMISSIONS.BRANCHES_WRITE)
  @ApiOperation({ summary: 'Criar filial para parceiro' })
  create(
    @Param('partnerId') partnerId: string,
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchesService.create(partnerId, dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.BRANCHES_WRITE)
  @ApiOperation({ summary: 'Atualizar filial' })
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto, @CurrentUser() user: AuthUser) {
    return this.branchesService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.BRANCHES_DELETE)
  @ApiOperation({ summary: 'Remover filial' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.branchesService.remove(id, user);
  }
}
