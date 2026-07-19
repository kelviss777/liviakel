import { Global, Module } from '@nestjs/common';
import { SupabaseAdminService } from './supabase-admin.service';
import { SupabaseService } from './supabase.service';
import { SupabaseUserClientFactory } from './supabase-user-client.factory';

@Global()
@Module({
  providers: [SupabaseService, SupabaseAdminService, SupabaseUserClientFactory],
  exports: [SupabaseService, SupabaseAdminService, SupabaseUserClientFactory],
})
export class SupabaseModule {}
