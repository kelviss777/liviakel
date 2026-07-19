import { Injectable } from '@nestjs/common';
import { throwForSupabaseError } from '../../common/utils/supabase-error.util';
import type { WeddingMemberRow } from '../../database/database.types';
import { TABLE_NAMES } from '../../database/table-names';
import { SupabaseUserClientFactory } from '../../infrastructure/supabase/supabase-user-client.factory';

@Injectable()
export class MembersRepository {
  constructor(private readonly clients: SupabaseUserClientFactory) {}

  async findByUser(userId: string, token: string): Promise<WeddingMemberRow[]> {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.weddingMembers)
      .select('wedding_id,user_id,role,created_at')
      .eq('user_id', userId)
      .limit(2);
    throwForSupabaseError(error, 'Não foi possível localizar o vínculo do casamento');
    return data ?? [];
  }
}
