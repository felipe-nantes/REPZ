import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { supabaseAdmin } from '../supabase/supabase.admin';

type Plan = 'monthly' | 'yearly';

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY não configurado.');

    // Ajustado para a versão do seu Stripe SDK
    this.stripe = new Stripe(key, { apiVersion: '2025-12-15.clover' as any });
  }

  private priceIdForPlan(plan: Plan): string {
    if (plan === 'monthly') return process.env.STRIPE_PRICE_MONTHLY!;
    if (plan === 'yearly') return process.env.STRIPE_PRICE_YEARLY!;
    throw new BadRequestException({ error: 'invalid_plan', message: 'Plano inválido.' });
  }

  async createCheckoutSession(userId: string, plan: Plan) {
    const price = this.priceIdForPlan(plan);
    if (!price) {
      throw new BadRequestException({
        error: 'missing_price_id',
        message: 'STRIPE_PRICE_* não configurado.',
      });
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;
    if (!successUrl || !cancelUrl) {
      throw new BadRequestException({
        error: 'missing_redirect_urls',
        message: 'STRIPE_SUCCESS_URL / STRIPE_CANCEL_URL não configurados.',
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        plan,
      },
    });

    return {
      url: session.url,
      sessionId: session.id,
    };
  }

  /**
   * Atualiza public.subscriptions com base na assinatura do Stripe.
   * Usa service role (ignora RLS).
   */
  async upsertSubscriptionFromStripe(stripeSubId: string, userId: string, plan: string) {
    const subRes = await this.stripe.subscriptions.retrieve(stripeSubId);

    // Compatibilidade: alguns SDKs tipam como Response<Subscription>
    const sub: any = (subRes as any).data ?? subRes;

    const status = String(sub.status);
    const currentPeriodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    const startedAt = sub.start_date
      ? new Date(sub.start_date * 1000).toISOString()
      : new Date().toISOString();

    const admin = supabaseAdmin();

    const { error } = await admin
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          status,
          plan,
          provider: 'stripe',
          cancel_at_period_end: Boolean(sub.cancel_at_period_end),
          current_period_end: currentPeriodEnd,
          started_at: startedAt,
        },
        { onConflict: 'user_id' },
      );

    if (error) {
      throw new Error(`[supabase-admin] ${error.message}`);
    }
  }
}
