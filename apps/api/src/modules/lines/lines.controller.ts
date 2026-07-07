import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LineStatus } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { LinesService } from './lines.service';
import { CreateLineDto, ReserveLineDto, UpdateLineDto } from './dto/line.dto';

@ApiTags('Lines')
@ApiBearerAuth()
@Controller('lines')
export class LinesController {
  constructor(private linesService: LinesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LINES_READ)
  @ApiOperation({ summary: 'Listar linhas' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('status') status?: LineStatus,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.linesService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      search: pagination.search,
      status,
      partnerId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LINES_READ)
  @ApiOperation({ summary: 'Obter linha por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.linesService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.LINES_WRITE)
  @ApiOperation({ summary: 'Criar linha' })
  create(@Body() dto: CreateLineDto, @CurrentUser() user: AuthUser) {
    return this.linesService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LINES_WRITE)
  @ApiOperation({ summary: 'Atualizar linha' })
  update(@Param('id') id: string, @Body() dto: UpdateLineDto, @CurrentUser() user: AuthUser) {
    return this.linesService.update(id, dto, user);
  }

  @Post(':id/reserve')
  @RequirePermissions(PERMISSIONS.LINES_WRITE)
  @ApiOperation({ summary: 'Reservar linha' })
  reserve(@Param('id') id: string, @Body() dto: ReserveLineDto, @CurrentUser() user: AuthUser) {
    return this.linesService.reserve(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.LINES_WRITE)
  @ApiOperation({ summary: 'Remover linha' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.linesService.remove(id, user);
  }
}
