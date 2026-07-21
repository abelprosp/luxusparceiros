import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinancialType } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { FinancialService } from './financial.service';
import { CreateFinancialRecordDto, UpdateFinancialRecordDto } from './dto/financial.dto';

class FinancialQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(FinancialType)
  type?: FinancialType;

  @IsOptional()
  @IsUUID()
  partnerId?: string;
}

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
    @Query() query: FinancialQueryDto,
  ) {
    return this.financialService.findAll(user, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      type: query.type,
      partnerId: query.partnerId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.FINANCIAL_READ)
  @ApiOperation({ summary: 'Obter registro financeiro por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financialService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.FINANCIAL_WRITE)
  @ApiOperation({ summary: 'Criar registro financeiro' })
  create(@Body() dto: CreateFinancialRecordDto, @CurrentUser() user: AuthUser) {
    return this.financialService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FINANCIAL_WRITE)
  @ApiOperation({ summary: 'Atualizar registro financeiro' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFinancialRecordDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financialService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.FINANCIAL_WRITE)
  @ApiOperation({ summary: 'Remover registro financeiro' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financialService.remove(id, user);
  }
}
