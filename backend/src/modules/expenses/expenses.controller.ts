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
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { ExpensesService } from './expenses.service';
@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}
  @Get() list(@Req() r: AuthenticatedRequest, @Query() q: ListExpensesQueryDto) {
    return this.service.list(r, q);
  }
  @Post() create(@Req() r: AuthenticatedRequest, @Body() d: CreateExpenseDto) {
    return this.service.create(r, d);
  }
  @Patch(':id') update(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateExpenseDto,
  ) {
    return this.service.update(r, id, d);
  }
  @Patch(':id/payment-status') status(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdatePaymentStatusDto,
  ) {
    return this.service.paymentStatus(r, id, d);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) delete(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(r, id);
  }
}
