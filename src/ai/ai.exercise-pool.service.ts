import { Injectable } from '@nestjs/common';
import { supabaseForUser } from '../supabase/supabase.client';

export type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: string | null;
  sub_group: string | null;
  equipment: string | null;
  image_url: string | null;
};

@Injectable()
export class ExercisePoolService {
  async getPool(accessToken: string, focus: string[]): Promise<ExerciseRow[]> {
    const supabase = supabaseForUser(accessToken);

    // Como você liberou "todos os equipamentos", filtramos só por músculo.
    // Incluímos alguns grupos auxiliares úteis (ex.: face pull costuma estar em back/shoulders).
    const f = new Set((focus ?? []).map((x) => String(x).toLowerCase()));
    const groups = new Set<string>();

    for (const x of f) groups.add(x);

    // heurísticas simples para treinos mais “completos” sem quebrar o foco
    if (groups.has('shoulders')) groups.add('back');
    if (groups.has('chest')) groups.add('shoulders');

    const muscleGroups = Array.from(groups);

    const { data, error } = await supabase
      .from('exercises')
      .select('id,name,muscle_group,sub_group,equipment,image_url')
      .in('muscle_group', muscleGroups)
      .limit(200);

    if (error) throw new Error(error.message);

    return (data ?? []) as ExerciseRow[];
  }
}
