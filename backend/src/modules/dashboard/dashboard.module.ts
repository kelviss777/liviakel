import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';
@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository, SupabaseAuthGuard],
})
export class DashboardModule {}
