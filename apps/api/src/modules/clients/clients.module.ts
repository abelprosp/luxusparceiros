import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { UploadsModule } from '@/modules/uploads/uploads.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AuditModule, UploadsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
