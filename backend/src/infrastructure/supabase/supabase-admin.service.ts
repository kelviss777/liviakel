import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAdminService {
  private readonly client: SupabaseClient | null;

  constructor(config: ConfigService) {
    const secret = config.get<string | null>('supabase.secretKey');
    this.client = secret
      ? createClient(config.getOrThrow<string>('supabase.url'), secret, {
          auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        })
      : null;
  }

  get isConfigured() {
    return this.client !== null;
  }

  async inviteUserByEmail(email: string): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error('Falha ao enviar o convite pelo provedor de autenticação');
  }
}
