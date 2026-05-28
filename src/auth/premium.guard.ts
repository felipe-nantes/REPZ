import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from '../subscription/subscription.service';
import { PAYWALL_CONTRACT } from '../paywall/paywall.contract';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const accessToken: string | undefined = req.accessToken;
    const userId: string | undefined = req.user?.id;

    // Se o SupabaseAuthGuard não tiver injetado, bloqueia de forma segura
    if (!accessToken || !userId) {
      throw new HttpException(
        {
          error: 'unauthorized',
          message: 'Autenticação necessária.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const ok = await this.subscriptionService.isPremium(accessToken, userId);

    if (!ok) {
      // 402 com contrato padronizado (paywall)
      throw new HttpException(PAYWALL_CONTRACT, HttpStatus.PAYMENT_REQUIRED);
    }

    return true;
  }
}
