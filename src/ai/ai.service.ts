import { Injectable } from '@nestjs/common';
import type { ExerciseRow } from './ai.exercise-pool.service';

type WorkoutV1 = {
  meta: any;
  warmup?: any[];
  blocks: any[];
  substitutions?: any[];
  progression?: any;
  safety?: any;
};

function normalizeName(name: string) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

@Injectable()
export class AiService {
  buildWorkoutV1(input: any, pool: ExerciseRow[]): WorkoutV1 {
    const goal = input?.goal ?? 'hypertrophy';
    const durationMinutes =
      typeof input?.durationMinutes === 'number' ? input.durationMinutes : 45;

    const focus =
      Array.isArray(input?.focus) && input.focus.length > 0
        ? input.focus
        : ['fullbody'];

    return {
      meta: {
        schema: 'repz.ai_workout.v1',
        id: this.makeId(),
        source: 'template',
        tz: 'America/Sao_Paulo',
        generatedAt: new Date().toISOString(),
        version: 'ai_workout_v1',
        goal,
        durationMinutes,
        focus,
      },
      warmup: [
        { name: 'Mobilidade de ombro', durationMin: 4 },
        { name: 'Séries de aproximação', durationMin: 4 },
      ],
      blocks: this.buildBlocks(focus, pool),
      substitutions: this.buildSubstitutions(pool),
      progression: {
        rule: 'double_progression',
        nextSession:
          'Se bater topo de reps em todas as séries, suba 2-5% de carga.',
      },
      safety: {
        disclaimer:
          'Ajuste cargas conforme sua capacidade. Em caso de dor aguda, interrompa.',
      },
    };
  }

  buildWorkoutPreview(input: any, pool: ExerciseRow[]) {
    const full = this.buildWorkoutV1(input, pool);

    return {
      preview: true,
      meta: {
        ...full.meta,
        version: 'ai_workout_preview_v1',
      },
      warmup: full.warmup,
      blocks: full.blocks.map((b: any) => ({
        ...b,
        exercises: b.exercises.map((e: any) => ({
          exerciseId: e.exerciseId,
          name: e.name,
          locked: true,
          blurHint: 'Séries, reps e progressão no Premium.',
        })),
      })),
      substitutions: full.substitutions,
      cta: { label: 'Ativar Premium', route: 'paywall' },
    };
  }

  // -------------------------
  // BLOCO PRINCIPAL
  // -------------------------

  private buildBlocks(focus: string[], pool: ExerciseRow[]) {
    const f = new Set(focus.map((x) => String(x).toLowerCase()));

    const isChest = f.has('chest');
    const isShoulders = f.has('shoulders');

    if (isChest && isShoulders) {
      const bench = this.pick(pool, [
        'dumbbell bench press',
        'barbell bench press',
        'chest press',
      ]);

      const lateral = this.pick(pool, [
        'cable lateral raise',
        'dumbbell lateral raise',
      ]);

      const incline = this.pick(pool, [
        'incline dumbbell bench press',
        'incline dumbbell press',
      ]);

      const facepull = this.pick(pool, ['face pull']);

      return [
        {
          title: 'Força guiada',
          type: 'main',
          restSec: 120,
          exercises: [
            this.ex(bench, [
              { set: 1, reps: '6-8', rpe: 8 },
              { set: 2, reps: '6-8', rpe: 8 },
              { set: 3, reps: '6-8', rpe: 9 },
            ]),
            this.ex(lateral, [
              { set: 1, reps: '12-15', rpe: 8 },
              { set: 2, reps: '12-15', rpe: 9 },
            ]),
          ],
        },
        {
          title: 'Acessórios',
          type: 'accessory',
          restSec: 75,
          exercises: [
            this.ex(incline, [
              { set: 1, reps: '8-10', rpe: 8 },
              { set: 2, reps: '8-10', rpe: 9 },
            ]),
            this.ex(facepull, [
              { set: 1, reps: '12-15', rpe: 8 },
              { set: 2, reps: '12-15', rpe: 8 },
            ]),
          ],
        },
      ];
    }

    return [];
  }

  // -------------------------
  // HELPERS
  // -------------------------

  private pick(pool: ExerciseRow[], candidates: string[]): ExerciseRow | null {
    for (const candidate of candidates) {
      const key = normalizeName(candidate);

      const found =
        pool.find((e) =>
          normalizeName(e.name).includes(key),
        ) ?? null;

      if (found) return found;
    }

    return null;
  }

  private ex(
    chosen: ExerciseRow | null,
    sets: any[],
  ) {
    if (!chosen) {
      throw new Error(
        'Exercício não encontrado no catálogo. Verifique o pool.',
      );
    }

    return {
      exerciseId: chosen.id,
      name: chosen.name,
      sets,
    };
  }

  private buildSubstitutions(pool: ExerciseRow[]) {
    const bench = this.pick(pool, [
      'dumbbell bench press',
      'barbell bench press',
    ]);

    const alt1 = this.pick(pool, ['chest press']);
    const alt2 = this.pick(pool, ['incline dumbbell bench press']);

    if (!bench) return [];

    return [
      {
        forExerciseId: bench.id,
        options: [alt1, alt2]
          .filter(Boolean)
          .map((e) => ({
            exerciseId: e!.id,
            name: e!.name,
          })),
      },
    ];
  }

  private makeId() {
    return 'w_' + Math.random().toString(16).slice(2);
  }
}
