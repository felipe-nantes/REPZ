import { Injectable } from '@nestjs/common';
import { supabaseForUser } from '../supabase/supabase.client';

@Injectable()
export class WorkoutsService {
  async startWorkoutWithUser(
    accessToken: string,
    userId: string,
    isAiGenerated: boolean,
  ) {
    const supabase = supabaseForUser(accessToken);

    const { data, error } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        is_ai_generated: isAiGenerated,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async addExercisesToWorkout(
    accessToken: string,
    userId: string,
    workoutId: string,
    exercises: Array<{ exerciseId: string; order: number }>,
  ) {
    const supabase = supabaseForUser(accessToken);

    // Garante que o workout pertence ao usuário
    const { data: workout, error: workoutErr } = await supabase
      .from('workouts')
      .select('id, user_id')
      .eq('id', workoutId)
      .single();

    if (workoutErr) throw new Error(workoutErr.message);
    if (!workout || workout.user_id !== userId) {
      throw new Error('Workout not found for user');
    }

    const rows = exercises.map((e) => ({
      workout_id: workoutId,
      exercise_id: e.exerciseId,
      order: e.order,
    }));

    const { data, error } = await supabase
      .from('workout_exercises')
      .insert(rows)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

async finishWorkout(
    accessToken: string,
    userId: string,
    workoutId: string,
    durationSeconds: number,
    ) {
  const supabase = supabaseForUser(accessToken);

  // garante que o workout pertence ao usuário
  const { data: workout, error: workoutErr } = await supabase
    .from('workouts')
    .select('id, user_id')
    .eq('id', workoutId)
    .single();

  if (workoutErr) throw new Error(workoutErr.message);
  if (!workout || workout.user_id !== userId) {
    throw new Error('Workout not found for user');
  }

  const { data, error } = await supabase
    .from('workouts')
    .update({ duration: durationSeconds })
    .eq('id', workoutId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
}