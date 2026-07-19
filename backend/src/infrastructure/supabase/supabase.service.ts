import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('supabase.url'),
      config.getOrThrow<string>('supabase.publishableKey'),
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
    );
  }

  async getUser(accessToken: string): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser(accessToken);
    return error ? null : data.user;
  }
}
