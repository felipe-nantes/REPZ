import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BillingService } from './billing.service';
import Stripe from 'stripe';

@Controller('billing')
export class BillingController {
  private stripe: Stripe;

  constructor(private readonly billingService: BillingService) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY não configurado.');

    // Ajustado para a versão do seu Stripe SDK
    this.stripe = new Stripe(key, { apiVersion: '2025-12-15.clover' as any });
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('checkout')
  async checkout(@Req() req: any, @Body() body: any) {
    const userId = req.user?.id;
    const plan = (body?.plan ?? 'monthly') as 'monthly' | 'yearly';

    if (!userId) {
      throw new BadRequestException({ error: 'missing_user', message: 'Usuário inválido.' });
    }

    return this.billingService.createCheckoutSession(userId, plan);
  }

  @Post('webhook')
  async webhook(@Req() req: any) {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !secret) {
      throw new BadRequestException({
        error: 'webhook_config_missing',
        message: 'stripe-signature ou STRIPE_WEBHOOK_SECRET ausente.',
      });
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err: any) {
      throw new BadRequestException({
        error: 'invalid_signature',
        message: err?.message ?? 'Assinatura inválida.',
      });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = (session.metadata?.user_id ?? '').toString();
      const plan = (session.metadata?.plan ?? 'monthly').toString();

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : null;

      if (userId && subscriptionId) {
        await this.billingService.upsertSubscriptionFromStripe(subscriptionId, userId, plan);
      }
    }

    return { received: true };
  }
}
