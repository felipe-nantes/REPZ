import { Injectable } from '@nestjs/common';
import { supabaseForUser } from '../supabase/supabase.client';

@Injectable()
export class SetsService {
  async addSet(
    accessToken: string,
    userId: string,
    workoutExerciseId: string,
    payload: { weight?: number; reps?: number; completed?: boolean },
  ) {
    const supabase = supabaseForUser(accessToken);

    // 1) Garantir que o workout_exercise pertence a um workout do usuário
    const { data: wex, error: wexErr } = await supabase
      .from('workout_exercises')
      .select('id, workout_id')
      .eq('id', workoutExerciseId)
      .single();

    if (wexErr) throw new Error(wexErr.message);
    if (!wex) throw new Error('Workout exercise not found');

    const { data: workout, error: workoutErr } = await supabase
      .from('workouts')
      .select('id, user_id')
      .eq('id', wex.workout_id)
      .single();

    if (workoutErr) throw new Error(workoutErr.message);
    if (!workout || workout.user_id !== userId) {
      throw new Error('Forbidden');
    }

    // 2) Inserir set
    const { data, error } = await supabase
      .from('sets')
      .insert({
        workout_exercise_id: workoutExerciseId,
        weight: payload.weight ?? null,
        reps: payload.reps ?? null,
        completed: payload.completed ?? true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
