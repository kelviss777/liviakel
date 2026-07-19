import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { WeddingsController } from './weddings.controller';
import { WeddingsRepository } from './weddings.repository';
import { WeddingsService } from './weddings.service';

@Module({
  controllers: [WeddingsController],
  providers: [WeddingsService, WeddingsRepository, SupabaseAuthGuard],
})
export class WeddingsModule {}
