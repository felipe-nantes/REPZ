import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SetsService } from './sets.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('workout-exercises')
export class SetsController {
  constructor(private readonly setsService: SetsService) {}

  /**
   * Cria uma série para um exercício de um treino
   * POST /workout-exercises/:workoutExerciseId/sets
   */
  @UseGuards(SupabaseAuthGuard)
  @Post(':workoutExerciseId/sets')
  async addSet(
    @Req() req: any,
    @Param('workoutExerciseId') workoutExerciseId: string,
    @Body() body: { weight?: number; reps?: number; completed?: boolean },
  ) {
    const accessToken: string = req.accessToken;
    const userId: string = req.user.id;

    return this.setsService.addSet(accessToken, userId, workoutExerciseId, body);
  }
}
