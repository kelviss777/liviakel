import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';
@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}
  @Get() list(@Req() r: AuthenticatedRequest, @Query() q: ListTasksQueryDto) {
    return this.service.list(r, q);
  }
  @Post() create(@Req() r: AuthenticatedRequest, @Body() d: CreateTaskDto) {
    return this.service.create(r, d);
  }
  @Patch(':id') update(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateTaskDto,
  ) {
    return this.service.update(r, id, d);
  }
  @Patch(':id/status') status(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateTaskStatusDto,
  ) {
    return this.service.status(r, id, d);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) delete(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(r, id);
  }
}
