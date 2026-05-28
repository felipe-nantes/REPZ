import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PremiumGuard } from '../auth/premium.guard';
import { AiService } from './ai.service';
import { AiCommitter } from './ai.committer';
import { ExercisePoolService } from './ai.exercise-pool.service';

@Controller('ai')
export class AiController { 
  constructor(
    private readonly aiService: AiService,
    private readonly aiCommitter: AiCommitter,
    private readonly exercisePool: ExercisePoolService,
  ) {}

  @UseGuards(SupabaseAuthGuard)
  @Get('workout/example')
  async example(
    @Req() req: any,
    @Query('goal') goal?: string,
    @Query('durationMinutes') durationMinutes?: string,
    @Query('focus') focus?: string,
  ) {
    const input = {
      goal: goal ?? 'hypertrophy',
      durationMinutes: durationMinutes ? Number(durationMinutes) : 45,
      focus: focus ? focus.split(',') : ['chest', 'shoulders'],
    };

    const pool = await this.exercisePool.getPool(req.accessToken, input.focus);
    return this.aiService.buildWorkoutPreview(input, pool);
  }

  @UseGuards(SupabaseAuthGuard, PremiumGuard)
  @Post('workout')
  async workout(@Req() req: any, @Body() body: any) {
    const focusArr =
      Array.isArray(body?.focus) && body.focus.length > 0 ? body.focus : ['fullbody'];

    const pool = await this.exercisePool.getPool(req.accessToken, focusArr);
    return this.aiService.buildWorkoutV1(body, pool);
  }

  @UseGuards(SupabaseAuthGuard, PremiumGuard)
  @Post('workout/commit')
  async commit(@Req() req: any, @Body() body: any) {
    return this.aiCommitter.commitWorkout(req.accessToken, req.user.id, body);
  }
}
