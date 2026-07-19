import { Injectable, NotFoundException } from '@nestjs/common';
import { throwForSupabaseError } from '../../common/utils/supabase-error.util';
import { TABLE_NAMES } from '../../database/table-names';
import { SupabaseUserClientFactory } from '../../infrastructure/supabase/supabase-user-client.factory';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import type { UpdateExpenseDto } from './dto/update-expense.dto';
@Injectable()
export class ExpensesRepository {
  constructor(private readonly clients: SupabaseUserClientFactory) {}
  async list(weddingId: string, token: string, f: ListExpensesQueryDto) {
    const from = (f.page - 1) * f.limit;
    let q = this.clients
      .create(token)
      .from(TABLE_NAMES.expenses)
      .select('*', { count: 'exact' })
      .eq('wedding_id', weddingId);
    if (f.search) q = q.ilike('name', `%${f.search}%`);
    if (f.category) q = q.eq('category', f.category);
    if (f.paid !== undefined) q = q.eq('paid', f.paid);
    const { data, count, error } = await q.order('name').range(from, from + f.limit - 1);
    throwForSupabaseError(error, 'Não foi possível listar as despesas');
    return { data: data ?? [], count: count ?? 0 };
  }
  async create(weddingId: string, token: string, input: CreateExpenseDto) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.expenses)
      .insert({ ...input, wedding_id: weddingId })
      .select()
      .single();
    throwForSupabaseError(error, 'Não foi possível criar a despesa');
    return data;
  }
  async update(id: string, weddingId: string, token: string, input: UpdateExpenseDto) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.expenses)
      .update(input)
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select()
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível atualizar a despesa');
    if (!data) throw new NotFoundException('Despesa não encontrada');
    return data;
  }
  async delete(id: string, weddingId: string, token: string) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.expenses)
      .delete()
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select('id')
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível excluir a despesa');
    if (!data) throw new NotFoundException('Despesa não encontrada');
  }
}
