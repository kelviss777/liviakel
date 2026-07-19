import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseUserClientFactory {
  constructor(private readonly config: ConfigService) {}

  create(accessToken: string): SupabaseClient {
    return createClient(
      this.config.getOrThrow<string>('supabase.url'),
      this.config.getOrThrow<string>('supabase.publishableKey'),
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      },
    );
  }
}
