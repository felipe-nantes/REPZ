import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  /**
   * Cria uma sessão de treino (workouts)
   * POST /workouts/start
   */
  @UseGuards(SupabaseAuthGuard)
  @Post('start')
  async start(@Req() req: any, @Body() body: { isAiGenerated?: boolean }) {
    const accessToken: string = req.accessToken;
    const userId: string = req.user.id;
    const isAiGenerated = Boolean(body?.isAiGenerated);

    return this.workoutsService.startWorkoutWithUser(
      accessToken,
      userId,
      isAiGenerated,
    );
  }

    /**
   * Cria um treino manual (FREE)
   * POST /workouts/manual
   */
  @UseGuards(SupabaseAuthGuard)
  @Post('manual')
  async manual(@Req() req: any) {
    const accessToken: string = req.accessToken;
    const userId: string = req.user.id;

    const workout = await this.workoutsService.startWorkoutWithUser(
      accessToken,
      userId,
      false, // manual sempre
    );

    return {
      mode: 'manual',
      workout,
      next: {
        addExercises: {
          method: 'POST',
          route: `/workouts/${workout.id}/exercises`,
        },
        finish: {
          method: 'POST',
          route: `/workouts/${workout.id}/finish`,
        },
      },
      message:
        'Treino manual iniciado. Adicione exercícios e registre as séries.',
    };
  }

  
  /**
   * Adiciona exercícios a um treino existente
   * POST /workouts/:workoutId/exercises
   */
  @UseGuards(SupabaseAuthGuard)
  @Post(':workoutId/exercises')
  async addExercises(
    @Req() req: any,
    @Param('workoutId') workoutId: string,
    @Body()
    body: { exercises: Array<{ exerciseId: string; order: number }> },
  ) {
    const accessToken: string = req.accessToken;
    const userId: string = req.user.id;

    return this.workoutsService.addExercisesToWorkout(
      accessToken,
      userId,
      workoutId,
      body.exercises,
    );
  }
@UseGuards(SupabaseAuthGuard)
@Post(':workoutId/finish')
async finish(
  @Req() req: any,
  @Param('workoutId') workoutId: string,
  @Body() body: { durationSeconds: number },
) {
  const accessToken: string = req.accessToken;
  const userId: string = req.user.id;

  const durationSeconds = Number(body?.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('durationSeconds must be a positive number');
  }

  return this.workoutsService.finishWorkout(
    accessToken,
    userId,
    workoutId,
    durationSeconds,
  );
}
}
