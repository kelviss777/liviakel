import { Injectable, NotFoundException } from '@nestjs/common';
import { throwForSupabaseError } from '../../common/utils/supabase-error.util';
import { TABLE_NAMES } from '../../database/table-names';
import { SupabaseUserClientFactory } from '../../infrastructure/supabase/supabase-user-client.factory';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
@Injectable()
export class TasksRepository {
  constructor(private readonly clients: SupabaseUserClientFactory) {}
  async list(weddingId: string, token: string, f: ListTasksQueryDto) {
    const from = (f.page - 1) * f.limit;
    let q = this.clients
      .create(token)
      .from(TABLE_NAMES.tasks)
      .select('*', { count: 'exact' })
      .eq('wedding_id', weddingId);
    if (f.search) q = q.ilike('name', `%${f.search}%`);
    if (f.category) q = q.eq('category', f.category);
    if (f.done !== undefined) q = q.eq('done', f.done);
    const { data, count, error } = await q
      .order('due_date', { ascending: true, nullsFirst: false })
      .range(from, from + f.limit - 1);
    throwForSupabaseError(error, 'Não foi possível listar as tarefas');
    return { data: data ?? [], count: count ?? 0 };
  }
  async create(weddingId: string, token: string, input: CreateTaskDto) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.tasks)
      .insert({ ...input, wedding_id: weddingId })
      .select()
      .single();
    throwForSupabaseError(error, 'Não foi possível criar a tarefa');
    return data;
  }
  async update(id: string, weddingId: string, token: string, input: UpdateTaskDto) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.tasks)
      .update(input)
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select()
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível atualizar a tarefa');
    if (!data) throw new NotFoundException('Tarefa não encontrada');
    return data;
  }
  async delete(id: string, weddingId: string, token: string) {
    const { data, error } = await this.clients
      .create(token)
      .from(TABLE_NAMES.tasks)
      .delete()
      .eq('id', id)
      .eq('wedding_id', weddingId)
      .select('id')
      .maybeSingle();
    throwForSupabaseError(error, 'Não foi possível excluir a tarefa');
    if (!data) throw new NotFoundException('Tarefa não encontrada');
  }
}
