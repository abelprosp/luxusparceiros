import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { LinesController } from './lines.controller';
import { LinesService } from './lines.service';

@Module({
  imports: [AuditModule],
  controllers: [LinesController],
  providers: [LinesService],
  exports: [LinesService],
})
export class LinesModule {}
