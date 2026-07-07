import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LineStatus } from '@prisma/client';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { SimCardsService } from './sim-cards.service';
import { CreateSimCardDto, TransferSimCardsDto, UpdateSimCardDto } from './dto/sim-card.dto';

@ApiTags('Sim Cards')
@ApiBearerAuth()
@Controller('sim-cards')
export class SimCardsController {
  constructor(private simCardsService: SimCardsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  @ApiOperation({ summary: 'Listar chips' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('status') status?: LineStatus,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.simCardsService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      search: pagination.search,
      status,
      partnerId,
    });
  }

  @Get('stock/summary')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  @ApiOperation({ summary: 'Resumo do estoque de chips' })
  stockSummary(@CurrentUser() user: AuthUser, @Query('partnerId') partnerId?: string) {
    return this.simCardsService.getStockSummary(user, partnerId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STOCK_READ)
  @ApiOperation({ summary: 'Obter chip por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.simCardsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.STOCK_WRITE)
  @ApiOperation({ summary: 'Cadastrar chip' })
  create(@Body() dto: CreateSimCardDto, @CurrentUser() user: AuthUser) {
    return this.simCardsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.STOCK_WRITE)
  @ApiOperation({ summary: 'Atualizar chip' })
  update(@Param('id') id: string, @Body() dto: UpdateSimCardDto, @CurrentUser() user: AuthUser) {
    return this.simCardsService.update(id, dto, user);
  }

  @Post('transfer')
  @RequirePermissions(PERMISSIONS.STOCK_WRITE)
  @ApiOperation({ summary: 'Transferir chips para parceiro' })
  transfer(@Body() dto: TransferSimCardsDto, @CurrentUser() user: AuthUser) {
    return this.simCardsService.transfer(dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.STOCK_WRITE)
  @ApiOperation({ summary: 'Remover chip' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.simCardsService.remove(id, user);
  }
}
