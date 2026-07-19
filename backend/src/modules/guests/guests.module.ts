import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { GuestsController } from './guests.controller';
import { GuestsRepository } from './guests.repository';
import { GuestsService } from './guests.service';
@Module({
  controllers: [GuestsController],
  providers: [GuestsService, GuestsRepository, SupabaseAuthGuard],
})
export class GuestsModule {}
