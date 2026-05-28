import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PremiumGuard } from '../auth/premium.guard';
import { AiCommitter } from './ai.committer';
import { ExercisePoolService } from './ai.exercise-pool.service';


@Module({
  imports: [SubscriptionModule],
  controllers: [AiController],
  providers: [AiService, PremiumGuard, AiCommitter, ExercisePoolService],
})
export class AiModule {}
