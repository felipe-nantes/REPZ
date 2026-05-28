import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { WorkoutsModule } from './workouts/workouts.module';
import { SetsModule } from './sets/sets.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { AiModule } from './ai/ai.module';
import { BillingModule } from './billing/billing.module';




@Module({
  imports: [WorkoutsModule, SetsModule, DashboardModule, SubscriptionModule, AiModule, BillingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
