import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { VenuesController } from './venues.controller';
import { VenuesRepository } from './venues.repository';
import { VenuesService } from './venues.service';
@Module({
  controllers: [VenuesController],
  providers: [VenuesService, VenuesRepository, SupabaseAuthGuard],
})
export class VenuesModule {}
