import { Injectable } from '@nestjs/common';
import { supabaseForUser } from '../supabase/supabase.client';

type SubscriptionRow = {
  user_id: string;
  status: string | null;
  plan: string | null;
  started_at: string | null;

  current_period_end?: string | null;
  provider?: string | null;
  cancel_at_period_end?: boolean | null;
  updated_at?: string | null;
};

function computeIsPremium(row: SubscriptionRow | null): boolean {
  if (!row) return false;

  const status = (row.status ?? 'none').toLowerCase();

  // REGRA DEFINITIVA: premium exige expiração válida
  const premiumStatus = status === 'active' || status === 'trialing';
  if (!premiumStatus) return false;

  const endRaw = row.current_period_end ?? null;
  if (!endRaw) return false;

  const end = new Date(endRaw);
  if (Number.isNaN(end.getTime())) return false;

  return Date.now() < end.getTime();
}

@Injectable()
export class SubscriptionService {
  async getMe(accessToken: string, userId: string) {
    const supabase = supabaseForUser(accessToken);

    const { data, error } = await supabase
      .from('subscriptions')
      .select(
        'user_id,status,plan,started_at,current_period_end,provider,cancel_at_period_end,updated_at',
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const row = (data as SubscriptionRow) ?? null;
    const isPremium = computeIsPremium(row);

    const features = {
      manual_workout: true, // free e premium têm
      ai_workout: isPremium, // premium destrava
      progression: isPremium, // premium destrava
      history_insights: true, // todos têm
    };

    return {
      isPremium,
      status: row?.status ?? 'none',
      plan: row?.plan ?? null,
      provider: row?.provider ?? null,
      startedAt: row?.started_at ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
      cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
      features,
    };
  }

  async isPremium(accessToken: string, userId: string): Promise<boolean> {
    const me = await this.getMe(accessToken, userId);
    return me.isPremium;
  }
  async devActivate(
  accessToken: string,
  userId: string,
  input: { plan: string; days: number },
) {
  const supabase = supabaseForUser(accessToken);

  const days = Math.max(1, Math.min(365, input.days)); // trava: 1..365
  const plan = input.plan ?? 'monthly';

  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // upsert: cria se não existir, atualiza se existir
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        status: 'active',
        plan,
        started_at: now.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: false,
        provider: 'dev',
      },
      { onConflict: 'user_id' },
    )
    .select(
      'user_id,status,plan,started_at,current_period_end,provider,cancel_at_period_end,updated_at',
    )
    .single();

  if (error) {
    throw new Error(`[supabase] ${error.message} | code=${(error as any).code ?? 'n/a'} | details=${JSON.stringify((error as any).details ?? null)}`);
  }

  // devolve no mesmo formato do /me/subscription
  return this.getMe(accessToken, userId);
}
}
