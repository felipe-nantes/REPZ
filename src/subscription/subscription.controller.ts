import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SubscriptionService } from './subscription.service';

@Controller('me')
export class MeController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @UseGuards(SupabaseAuthGuard)
  @Get('subscription')
  async subscription(@Req() req: any) {
    return this.subscriptionService.getMe(req.accessToken, req.user.id);
  }

  /**
   * DEV ONLY: ativa premium manualmente para testes do paywall/guard.
   * Produção: substituído por webhook (Stripe/Apple/Google).
   */
  @UseGuards(SupabaseAuthGuard)
  @Post('subscription/dev/activate')
  async devActivate(@Req() req: any, @Body() body: any) {
    const plan = typeof body?.plan === 'string' ? body.plan : 'monthly';
    const days = typeof body?.days === 'number' ? body.days : 30;

   try {
  return await this.subscriptionService.devActivate(req.accessToken, req.user.id, { plan, days });
} catch (e: any) {
  // força sair mensagem
  throw new Error(e?.message ?? 'devActivate failed');
}
    } }
