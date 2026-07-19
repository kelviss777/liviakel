import { Injectable, NotFoundException } from '@nestjs/common';
import { throwForSupabaseError } from '../../common/utils/supabase-error.util';
import { TABLE_NAMES } from '../../database/table-names';
import { SupabaseUserClientFactory } from '../../infrastructure/supabase/supabase-user-client.factory';
import type { ListInvitationsQueryDto } from './dto/list-invitations-query.dto';
@Injectable()
export class InvitationsRepository {
  constructor(private readonly clients: SupabaseUserClientFactory) {}
  async list(weddingId: string, token: string, filters: ListInvitationsQueryDto) {
    let query = this.clients
      .create(token)
      .from(TABLE_NAMES.weddingInvitations)
      .select('*')
      .eq('wedding_id', weddingId);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query.order('created_at', { ascending: false });
    throwForSupabaseError(error, 'Não foi possível listar os convites');
    return data ?? [];
  }
  async findPendingByEmail(weddingId: string, token: string, email: string) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.weddingInvitations)
      .select('id')
      .eq('wedding_id', weddingId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível validar o convite');
    return data;
  }
  async create(weddingId: string, token: string, email: string, invitedBy: string) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.weddingInvitations)
      .insert({ wedding_id: weddingId, email, invited_by: invitedBy, status: 'pending' })
      .select()
      .single();
    throwForSupabaseError(error, 'Não foi possível criar o convite');
    return data;
  }
  async delete(id: string, weddingId: string, token: string) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.weddingInvitations)
      .delete()
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select('id')
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível excluir o convite');
    if (!data) throw new NotFoundException('Convite não encontrado');
  }
}
