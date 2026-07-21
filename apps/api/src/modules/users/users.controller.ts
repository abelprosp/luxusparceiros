import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, PERMISSIONS } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'Listar usuários' })
  findAll(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.usersService.findAll(user, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
      search: pagination.search,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'Obter usuário por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: 'Criar usuário' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: 'Atualizar usuário' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @ApiOperation({ summary: 'Remover usuário' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.remove(id, user);
  }
}
