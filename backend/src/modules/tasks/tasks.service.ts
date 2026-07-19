import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { WeddingContextService } from '../members/wedding-context.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import type { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import { TasksRepository } from './tasks.repository';
@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly context: WeddingContextService,
  ) {}
  async list(r: AuthenticatedRequest, f: ListTasksQueryDto) {
    const w = await this.context.resolve(r);
    return this.repository.list(w.id, r.accessToken, f);
  }
  async create(r: AuthenticatedRequest, d: CreateTaskDto) {
    const w = await this.context.resolve(r);
    return this.repository.create(w.id, r.accessToken, d);
  }
  async update(r: AuthenticatedRequest, id: string, d: UpdateTaskDto) {
    if (!Object.keys(d).length) throw new BadRequestException('Informe um campo');
    const w = await this.context.resolve(r);
    return this.repository.update(id, w.id, r.accessToken, d);
  }
  status(r: AuthenticatedRequest, id: string, d: UpdateTaskStatusDto) {
    return this.update(r, id, { done: d.done });
  }
  async delete(r: AuthenticatedRequest, id: string) {
    const w = await this.context.resolve(r);
    await this.repository.delete(id, w.id, r.accessToken);
  }
}
