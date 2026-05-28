import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(SupabaseAuthGuard)
  @Get('summary')
  async summary(@Req() req: any) {
    const accessToken: string = req.accessToken;
    const userId: string = req.user.id;

    return this.dashboardService.getSummary(accessToken, userId);
  }
}
