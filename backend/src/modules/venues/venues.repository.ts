import { Injectable, NotFoundException } from '@nestjs/common';
import { throwForSupabaseError } from '../../common/utils/supabase-error.util';
import { TABLE_NAMES } from '../../database/table-names';
import { SupabaseUserClientFactory } from '../../infrastructure/supabase/supabase-user-client.factory';
import type { CreateVenueDto } from './dto/create-venue.dto';
import type { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import type { UpdateVenueDto } from './dto/update-venue.dto';
@Injectable()
export class VenuesRepository {
  constructor(private readonly clients: SupabaseUserClientFactory) {}
  async list(weddingId: string, token: string, f: ListVenuesQueryDto) {
    const from = (f.page - 1) * f.limit;
    let q = this.clients
      .create(token)
      .from(TABLE_NAMES.venues)
      .select('*', { count: 'exact' })
      .eq('wedding_id', weddingId);
    if (f.search) q = q.ilike('name', `%${f.search}%`);
    if (f.type) q = q.eq('type', f.type);
    if (f.favorite !== undefined) q = q.eq('favorite', f.favorite);
    const { data, count, error } = await q
      .order('favorite', { ascending: false })
      .order('name')
      .range(from, from + f.limit - 1);
    throwForSupabaseError(error, 'Não foi possível listar os locais');
    return { data: data ?? [], count: count ?? 0 };
  }
  async create(weddingId: string, token: string, input: CreateVenueDto) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.venues)
      .insert({ ...input, wedding_id: weddingId })
      .select()
      .single();
    throwForSupabaseError(error, 'Não foi possível criar o local');
    return data;
  }
  async update(id: string, weddingId: string, token: string, input: UpdateVenueDto) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.venues)
      .update(input)
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select()
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível atualizar o local');
    if (!data) throw new NotFoundException('Local não encontrado');
    return data;
  }
  async delete(id: string, weddingId: string, token: string) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.venues)
      .delete()
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select('id')
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível excluir o local');
    if (!data) throw new NotFoundException('Local não encontrado');
  }
}
