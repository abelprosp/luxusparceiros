import { Module } from '@nestjs/common';
import { CommissionsModule } from '@/modules/commissions/commissions.module';
import { OutboxService } from './outbox.service';

@Module({
  imports: [CommissionsModule],
  providers: [OutboxService],
})
export class OutboxModule {}
