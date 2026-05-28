import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { supabaseForUser } from '../supabase/supabase.client';

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
}

/**
 * Converte "6-8" -> 7 (média), "12-15" -> 14, "8" -> 8
 * Se vier algo inesperado, retorna null (e o insert usa reps null? aqui vamos bloquear)
 */
function repsToInt(reps: any): number | null {
  if (typeof reps === 'number' && Number.isFinite(reps)) return Math.round(reps);

  const s = String(reps ?? '').trim();
  if (!s) return null;

  // "6-8"
  const range = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b)) return Math.round((a + b) / 2);
  }

  // "8"
  const single = s.match(/^(\d+)$/);
  if (single) {
    const n = parseInt(single[1], 10);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

@Injectable()
export class AiCommitter {
  async commitWorkout(accessToken: string, userId: string, workoutJson: any) {
    try {
      if (!workoutJson?.meta || !Array.isArray(workoutJson?.blocks)) {
        throw new BadRequestException({
          error: 'invalid_workout_payload',
          message: 'Payload inválido: esperado meta e blocks[].',
        });
      }

      const supabase = supabaseForUser(accessToken);

      // 1) cria workout (AI)
      const { data: createdWorkout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          is_ai_generated: true,
        })
        .select('id')
        .single();

      if (wErr) {
        throw new BadRequestException({
          error: 'workout_insert_failed',
          message: wErr.message,
          details: wErr,
        });
      }

      const workoutId = createdWorkout.id as string;
      if (!isUuid(workoutId)) {
        throw new InternalServerErrorException({
          error: 'invalid_workout_id_returned',
          message: 'Banco retornou workoutId inválido.',
        });
      }

      // 2) flatten exercícios preservando order e sets
      const flat: Array<{
        order: number;
        exerciseId: string;
        sets: Array<{ reps?: any }>;
      }> = [];

      let orderCounter = 1;
      for (const block of workoutJson.blocks ?? []) {
        for (const ex of block.exercises ?? []) {
          if (!ex.exerciseId || typeof ex.exerciseId !== 'string' || !isUuid(ex.exerciseId)) {
            throw new BadRequestException({
              error: 'invalid_exercise_id',
              message: `Exercício sem exerciseId UUID válido: ${ex?.name ?? 'unknown'}`,
            });
          }

          flat.push({
            order: orderCounter++,
            exerciseId: ex.exerciseId,
            sets: Array.isArray(ex.sets) ? ex.sets : [],
          });
        }
      }

      if (flat.length === 0) {
        throw new BadRequestException({
          error: 'empty_workout',
          message: 'Treino sem exercícios.',
        });
      }

      // 3) inserir workout_exercises
      const weInsert = flat.map((e) => ({
        workout_id: workoutId,
        exercise_id: e.exerciseId,
        order: e.order,
      }));

      const { data: weRows, error: weErr } = await supabase
        .from('workout_exercises')
        .insert(weInsert)
        .select('id, order');

      if (weErr) {
        throw new BadRequestException({
          error: 'workout_exercises_insert_failed',
          message: weErr.message,
          details: weErr,
        });
      }

      const orderToWeId = new Map<number, string>();
      for (const row of weRows ?? []) {
        orderToWeId.set(row.order, row.id);
      }

      // 4) inserir sets conforme schema real:
      // (workout_exercise_id, weight, reps, completed)
      const setsInsert: Array<{
        workout_exercise_id: string;
        weight: number | null;
        reps: number;
        completed: boolean;
      }> = [];

      for (const e of flat) {
        const weId = orderToWeId.get(e.order);
        if (!weId) continue;

        // Se não vier sets no JSON, criamos 2 sets básicos para não salvar “vazio”
        const sourceSets = e.sets.length > 0 ? e.sets : [{ reps: '8-10' }, { reps: '8-10' }];

        for (const s of sourceSets) {
          const repsInt = repsToInt(s?.reps);
          if (!repsInt) {
            throw new BadRequestException({
              error: 'invalid_reps',
              message: `Reps inválido no exercício order=${e.order}. Valor: ${String(s?.reps)}`,
            });
          }

          setsInsert.push({
            workout_exercise_id: weId,
            weight: null,
            reps: repsInt,
            completed: false,
          });
        }
      }

      let createdSets = 0;
      if (setsInsert.length > 0) {
        const { error: sErr } = await supabase.from('sets').insert(setsInsert);
        if (sErr) {
          throw new BadRequestException({
            error: 'sets_insert_failed',
            message: sErr.message,
            details: sErr,
          });
        }
        createdSets = setsInsert.length;
      }

      return {
        workoutId,
        isAiGenerated: true,
        createdExercises: weInsert.length,
        createdSets,
        next: {
          finish: { method: 'POST', route: `/workouts/${workoutId}/finish` },
        },
      };
    } catch (err: any) {
      if (err?.getStatus) throw err; // HttpException com payload
      throw new InternalServerErrorException({
        error: 'commit_failed',
        message: err?.message ?? 'Falha ao commitar treino.',
      });
    }
  }
}
