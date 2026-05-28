import { Injectable } from '@nestjs/common';
import { supabaseForUser } from '../supabase/supabase.client';

const TZ_BR = 'America/Sao_Paulo';

function brDayKey(date: Date): string {
  // Retorna YYYY-MM-DD no fuso de São Paulo
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function brMonthStartIso(now: Date): string {
  // Início do mês (00:00) no fuso BR, convertido para ISO UTC aproximado para filtro.
  // Para MVP: usamos a data BR do dia 01 e filtramos por created_at >= "YYYY-MM-01T00:00:00-03:00" convertido via Date.
  const dayKey = brDayKey(now); // YYYY-MM-DD
  const [yy, mm] = dayKey.split('-');
  const first = `${yy}-${mm}-01T00:00:00-03:00`;
  return new Date(first).toISOString();
}

function formatHoursPtBR(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatKgPtBR(value: number): string {
  // "48.200 kg" (padrão BR)
  const rounded = Math.round(value);
  return `${rounded.toLocaleString('pt-BR')} kg`;
}

@Injectable()
export class DashboardService {
  async getSummary(accessToken: string, userId: string) {
    const supabase = supabaseForUser(accessToken);

    const now = new Date();
    const monthStartIso = brMonthStartIso(now);
    const nowIso = now.toISOString();

    // 1) Workouts do mês (e duração)
    const { data: workouts, error: workoutsErr } = await supabase
      .from('workouts')
      .select('id, created_at, duration')
      .eq('user_id', userId)
      .gte('created_at', monthStartIso)
      .lte('created_at', nowIso);

    if (workoutsErr) throw new Error(workoutsErr.message);

    const workoutsThisMonth = workouts?.length ?? 0;

    const totalSecondsThisMonth = (workouts ?? []).reduce((acc, w) => {
      const dur = typeof w.duration === 'number' ? w.duration : 0;
      return acc + dur;
    }, 0);

    // 2) Volume do mês: sum(weight * reps) para sets completed
    const workoutIds = (workouts ?? []).map((w) => w.id);
    let totalVolumeThisMonth = 0;

    // Para top exercises
    const exerciseCount = new Map<string, number>();

    if (workoutIds.length > 0) {
      const { data: wex, error: wexErr } = await supabase
        .from('workout_exercises')
        .select('id, workout_id, exercise_id')
        .in('workout_id', workoutIds);

      if (wexErr) throw new Error(wexErr.message);

      (wex ?? []).forEach((row) => {
        if (!row.exercise_id) return;
        exerciseCount.set(
          row.exercise_id,
          (exerciseCount.get(row.exercise_id) ?? 0) + 1,
        );
      });

      const wexIds = (wex ?? []).map((x) => x.id);

      if (wexIds.length > 0) {
        const { data: sets, error: setsErr } = await supabase
          .from('sets')
          .select('weight, reps, completed')
          .in('workout_exercise_id', wexIds)
          .eq('completed', true);

        if (setsErr) throw new Error(setsErr.message);

        totalVolumeThisMonth = (sets ?? []).reduce((acc, s) => {
          const w = typeof s.weight === 'number' ? s.weight : 0;
          const r = typeof s.reps === 'number' ? s.reps : 0;
          return acc + w * r;
        }, 0);
      }
    }

    // 3) Enriquecer Top 3 exercícios
    const top3 = [...exerciseCount.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    let topExercises: Array<{
      id: string;
      name: string;
      muscle_group: string | null;
      image_url: string | null;
      count: number;
    }> = [];

    if (top3.length > 0) {
      const ids = top3.map((t) => t.id);
      const { data: exRows, error: exErr } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, image_url')
        .in('id', ids);

      if (exErr) throw new Error(exErr.message);

      const byId = new Map(
        (exRows ?? []).map((e) => [e.id, e] as const),
      );

      topExercises = top3
        .map((t) => {
          const ex = byId.get(t.id);
          if (!ex) return null;
          return {
            id: ex.id,
            name: ex.name,
            muscle_group: ex.muscle_group ?? null,
            image_url: ex.image_url ?? null,
            count: t.count,
          };
        })
        .filter(Boolean) as any;
    }

    // 4) Streak BR (conta dias com treino finalizado: duration != null)
    const { data: recentWorkouts, error: recentErr } = await supabase
      .from('workouts')
      .select('created_at, duration')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(90);

    if (recentErr) throw new Error(recentErr.message);

    const trainedDays = new Set<string>();
    (recentWorkouts ?? []).forEach((w) => {
      if (w.duration == null) return;
      trainedDays.add(brDayKey(new Date(w.created_at)));
    });

    let currentStreakDays = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = brDayKey(d);
      if (trainedDays.has(key)) currentStreakDays++;
      else break;
    }

    // 5) Estruturar resposta “front-friendly” + gatilhos (sem mentir)
    const hoursLabel = formatHoursPtBR(totalSecondsThisMonth);
    const volumeLabel = formatKgPtBR(totalVolumeThisMonth);

    const streakLabel =
      currentStreakDays === 0
        ? 'Comece hoje'
        : currentStreakDays === 1
          ? '1 dia'
          : `${currentStreakDays} dias`;

    const insights: Array<{ type: string; title: string; message: string }> = [];

    if (currentStreakDays >= 3) {
      insights.push({
        type: 'momentum',
        title: 'Ritmo forte',
        message:
          'Você está criando consistência. Não quebre a sequência agora.',
      });
    } else if (currentStreakDays === 1) {
      insights.push({
        type: 'starter',
        title: 'Bom começo',
        message:
          'Feche 3 dias seguidos para entrar no modo automático.',
      });
    } else {
      insights.push({
        type: 'nudge',
        title: 'Um treino muda o dia',
        message:
          'Faça um treino rápido hoje e reinicie sua sequência.',
      });
    }

    if (workoutsThisMonth >= 8) {
      insights.push({
        type: 'consistency',
        title: 'Consistência no mês',
        message:
          'Seu mês está sólido. Continue e você fecha um ciclo forte.',
      });
    }

    const period = {
      tz: TZ_BR,
      monthStart: brDayKey(new Date(monthStartIso)),
      today: brDayKey(now),
    };

    return {
      period,
      cards: [
        {
          id: 'workouts_month',
          title: 'Treinos no mês',
          value: workoutsThisMonth,
          subtitle:
            workoutsThisMonth >= 8
              ? 'Ritmo de evolução'
              : 'Vamos subir a consistência',
        },
        {
          id: 'hours_month',
          title: 'Horas treinadas',
          value: hoursLabel,
          subtitle: 'Tempo investido em resultado',
        },
        {
          id: 'volume_month',
          title: 'Volume total',
          value: volumeLabel,
          subtitle: 'Força construída no mês',
        },
        {
          id: 'streak',
          title: 'Sequência atual',
          value: streakLabel,
          subtitle: currentStreakDays >= 3 ? 'Não quebra agora' : 'Vamos engrenar',
        },
      ],
      streak: {
        currentDays: currentStreakDays,
        label:
          currentStreakDays === 0
            ? 'Sem sequência'
            : currentStreakDays === 1
              ? '1 dia seguido'
              : `${currentStreakDays} dias seguidos`,
        message:
          currentStreakDays >= 7
            ? 'Você fechou uma semana. Agora é manter o padrão.'
            : currentStreakDays >= 3
              ? 'Mais alguns dias e isso vira hábito.'
              : 'Faça o próximo treino e comece a construir consistência.',
      },
      topExercises,
      raw: {
        workoutsThisMonth,
        totalSecondsThisMonth,
        totalVolumeThisMonth,
      },
      insights,
      cta: {
        title: 'Quer um treino pronto em 30 segundos?',
        message:
          'Ative o Premium e receba treinos gerados por IA com progressão e lógica.',
        action: { label: 'Ativar Premium', route: 'paywall' },
      },
    };
  }
}
