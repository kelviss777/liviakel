import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ExpensesController } from './expenses.controller';
import { ExpensesRepository } from './expenses.repository';
import { ExpensesService } from './expenses.service';
@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, ExpensesRepository, SupabaseAuthGuard],
})
export class ExpensesModule {}
