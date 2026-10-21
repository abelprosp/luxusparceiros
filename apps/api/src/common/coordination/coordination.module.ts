import { Global, Module } from '@nestjs/common';
import { CoordinationService } from './coordination.service';

@Global()
@Module({
  providers: [CoordinationService],
  exports: [CoordinationService],
})
export class CoordinationModule {}
