import { Injectable } from '@nestjs/common';
import { throwForSupabaseError } from '../../common/utils/supabase-error.util';
import type { WeddingRow } from '../../database/database.types';
import { TABLE_NAMES } from '../../database/table-names';
import { SupabaseUserClientFactory } from '../../infrastructure/supabase/supabase-user-client.factory';
import type { UpdateWeddingDto } from './dto/update-wedding.dto';

@Injectable()
export class WeddingsRepository {
  constructor(private readonly clients: SupabaseUserClientFactory) {}

  async findCurrent(id: string, token: string): Promise<WeddingRow> {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.weddings)
      .select('*')
      .eq('id', id)
      .single();
    throwForSupabaseError(error, 'Não foi possível carregar o casamento');
    return data as WeddingRow;
  }

  async updateCurrent(id: string, token: string, input: UpdateWeddingDto): Promise<WeddingRow> {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.weddings)
      .update(input)
      .eq('id', id)
      .select()
      .single();
    throwForSupabaseError(error, 'Não foi possível atualizar o casamento');
    return data as WeddingRow;
  }
}
