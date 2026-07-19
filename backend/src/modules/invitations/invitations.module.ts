import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { InvitationsController } from './invitations.controller';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';
@Module({
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsRepository, SupabaseAuthGuard],
})
export class InvitationsModule {}
