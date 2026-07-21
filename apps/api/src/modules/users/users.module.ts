import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { UsersController } from './users.controller';
import { ProfileController } from './profile.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule],
  controllers: [UsersController, ProfileController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
