import { Injectable, NotFoundException } from '@nestjs/common';
import { throwForSupabaseError } from '../../common/utils/supabase-error.util';
import { TABLE_NAMES } from '../../database/table-names';
import { SupabaseUserClientFactory } from '../../infrastructure/supabase/supabase-user-client.factory';
import type { CreateGuestDto } from './dto/create-guest.dto';
import type { ListGuestsQueryDto } from './dto/list-guests-query.dto';
import type { UpdateGuestDto } from './dto/update-guest.dto';

@Injectable()
export class GuestsRepository {
  constructor(private readonly clients: SupabaseUserClientFactory) {}
  async list(weddingId: string, token: string, filters: ListGuestsQueryDto) {
    const from = (filters.page - 1) * filters.limit;
    let query = this.clients
      .create(token)
      .from(TABLE_NAMES.guests)
      .select('*', { count: 'exact' })
      .eq('wedding_id', weddingId);
    if (filters.search) query = query.ilike('name', `%${filters.search}%`);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.guest_group) query = query.eq('guest_group', filters.guest_group);
    const { data, count, error } = await query.order('name').range(from, from + filters.limit - 1);
    throwForSupabaseError(error, 'Não foi possível listar os convidados');
    return { data: data ?? [], count: count ?? 0 };
  }
  async create(weddingId: string, token: string, input: CreateGuestDto) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.guests)
      .insert({ ...input, wedding_id: weddingId })
      .select()
      .single();
    throwForSupabaseError(error, 'Não foi possível criar o convidado');
    return data;
  }
  async update(id: string, weddingId: string, token: string, input: UpdateGuestDto) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.guests)
      .update(input)
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select()
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível atualizar o convidado');
    if (!data) throw new NotFoundException('Convidado não encontrado');
    return data;
  }
  async delete(id: string, weddingId: string, token: string) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.guests)
      .delete()
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select('id')
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível excluir o convidado');
    if (!data) throw new NotFoundException('Convidado não encontrado');
  }
}
