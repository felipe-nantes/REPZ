import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { MeController } from './subscription.controller';

@Module({
  controllers: [MeController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
