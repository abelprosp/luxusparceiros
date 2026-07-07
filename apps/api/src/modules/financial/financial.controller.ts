import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinancialType } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FinancialService } from './financial.service';
import { CreateFinancialRecordDto, UpdateFinancialRecordDto } from './dto/financial.dto';

@ApiTags('Financial')
@ApiBearerAuth()
@Controller('financial')
export class FinancialController {
  constructor(private financialService: FinancialService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.FINANCIAL_READ)
  @ApiOperation({ summary: 'Listar registros financeiros' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('type') type?: FinancialType,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.financialService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      type,
      partnerId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FINANCIAL_READ)
  @ApiOperation({ summary: 'Obter registro financeiro por ID' })
  findOne(@Param('id') id: string) {
    return this.financialService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FINANCIAL_WRITE)
  @ApiOperation({ summary: 'Criar registro financeiro' })
  create(@Body() dto: CreateFinancialRecordDto, @CurrentUser() user: AuthUser) {
    return this.financialService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FINANCIAL_WRITE)
  @ApiOperation({ summary: 'Atualizar registro financeiro' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financialService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.FINANCIAL_WRITE)
  @ApiOperation({ summary: 'Remover registro financeiro' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financialService.remove(id, user.id);
  }
}
