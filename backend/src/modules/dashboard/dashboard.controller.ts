import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { DashboardService } from './dashboard.service';
@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get() get(@Req() request: AuthenticatedRequest) {
    return this.service.getDashboard(request);
  }
}
