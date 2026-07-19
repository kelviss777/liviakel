import { Injectable } from '@nestjs/common';
import { throwForSupabaseError } from '../../common/utils/supabase-error.util';
import type { ExpenseRow, TaskRow, WeddingRow } from '../../database/database.types';
import { TABLE_NAMES } from '../../database/table-names';
import { SupabaseUserClientFactory } from '../../infrastructure/supabase/supabase-user-client.factory';
@Injectable()
export class DashboardRepository {
  constructor(private readonly clients: SupabaseUserClientFactory) {}
  async getSnapshot(weddingId: string, token: string) {
    const client = this.clients.create(token);
    const results = await Promise.all([
      client.from(TABLE_NAMES.weddings).select('*').eq('id', weddingId).single(),
      client
        .from(TABLE_NAMES.guests)
        .select('id', { count: 'exact', head: true })
        .eq('wedding_id', weddingId),
      client
        .from(TABLE_NAMES.guests)
        .select('id', { count: 'exact', head: true })
        .eq('wedding_id', weddingId)
        .eq('status', 'confirmed'),
      client
        .from(TABLE_NAMES.tasks)
        .select('id', { count: 'exact', head: true })
        .eq('wedding_id', weddingId),
      client
        .from(TABLE_NAMES.tasks)
        .select('id', { count: 'exact', head: true })
        .eq('wedding_id', weddingId)
        .eq('done', true),
      client
        .from(TABLE_NAMES.tasks)
        .select('id,name,category,due_date,done')
        .eq('wedding_id', weddingId)
        .eq('done', false)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(4),
      client.from(TABLE_NAMES.expenses).select('value,paid').eq('wedding_id', weddingId),
    ]);
    results.forEach((result) =>
      throwForSupabaseError(result.error, 'Não foi possível carregar o dashboard'),
    );
    return {
      wedding: results[0].data as WeddingRow,
      guestsTotal: results[1].count ?? 0,
      guestsConfirmed: results[2].count ?? 0,
      tasksTotal: results[3].count ?? 0,
      tasksCompleted: results[4].count ?? 0,
      upcomingTasks: (results[5].data ?? []) as TaskRow[],
      expenses: (results[6].data ?? []) as ExpenseRow[],
    };
  }
}
