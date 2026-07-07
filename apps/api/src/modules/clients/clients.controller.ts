import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLIENTS_READ)
  @ApiOperation({ summary: 'Listar clientes' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
    @Query('partnerId') partnerId?: string,
  ) {
    return this.clientsService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      search: pagination.search,
      partnerId,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLIENTS_READ)
  @ApiOperation({ summary: 'Obter cliente por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.clientsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLIENTS_WRITE)
  @ApiOperation({ summary: 'Criar cliente' })
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthUser) {
    return this.clientsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLIENTS_WRITE)
  @ApiOperation({ summary: 'Atualizar cliente' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: AuthUser) {
    return this.clientsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CLIENTS_DELETE)
  @ApiOperation({ summary: 'Remover cliente' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.clientsService.remove(id, user);
  }
}
