import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';
@Module({
  controllers: [TasksController],
  providers: [TasksService, TasksRepository, SupabaseAuthGuard],
})
export class TasksModule {}
