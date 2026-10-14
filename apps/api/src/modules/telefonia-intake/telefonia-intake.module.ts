import { Module } from '@nestjs/common';
import { TelefoniaIntakeService } from './telefonia-intake.service';

@Module({
  providers: [TelefoniaIntakeService],
  exports: [TelefoniaIntakeService],
})
export class TelefoniaIntakeModule {}
