import { Module, forwardRef } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { TaskIntegrationModule } from '@/modules/task-integration/task-integration.module';

@Module({
  imports: [forwardRef(() => TaskIntegrationModule)],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
