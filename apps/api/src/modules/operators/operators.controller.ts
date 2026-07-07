import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { OperatorsService } from './operators.service';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/operator.dto';

@ApiTags('Operators')
@ApiBearerAuth()
@Controller('operators')
export class OperatorsController {
  constructor(private operatorsService: OperatorsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.OPERATORS_READ)
  @ApiOperation({ summary: 'Listar operadoras' })
  findAll(@Query() pagination: PaginationDto) {
    return this.operatorsService.findAll({
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      search: pagination.search,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.OPERATORS_READ)
  @ApiOperation({ summary: 'Obter operadora por ID' })
  findOne(@Param('id') id: string) {
    return this.operatorsService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OPERATORS_WRITE)
  @ApiOperation({ summary: 'Criar operadora' })
  create(@Body() dto: CreateOperatorDto, @CurrentUser() user: AuthUser) {
    return this.operatorsService.create(dto, user.id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.OPERATORS_WRITE)
  @ApiOperation({ summary: 'Atualizar operadora' })
  update(@Param('id') id: string, @Body() dto: UpdateOperatorDto, @CurrentUser() user: AuthUser) {
    return this.operatorsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.OPERATORS_WRITE)
  @ApiOperation({ summary: 'Remover operadora' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.operatorsService.remove(id, user.id);
  }
}
