import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UpdatePartnerProfileDto, UpdateProfileDto } from './dto/profile.dto';
import { UsersService } from './users.service';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
export class ProfileController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Obter o perfil do usuário autenticado' })
  get(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user);
  }

  @Put()
  @ApiOperation({ summary: 'Atualizar preferências do usuário autenticado' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user, dto);
  }

  @Put('partner')
  @ApiOperation({ summary: 'Atualizar dados bancários do parceiro autenticado' })
  updatePartner(@CurrentUser() user: AuthUser, @Body() dto: UpdatePartnerProfileDto) {
    return this.usersService.updatePartnerProfile(user, dto);
  }
}
