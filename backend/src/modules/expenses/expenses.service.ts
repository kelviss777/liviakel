import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { WeddingContextService } from '../members/wedding-context.service';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import type { UpdateExpenseDto } from './dto/update-expense.dto';
import type { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { ExpensesRepository } from './expenses.repository';
@Injectable()
export class ExpensesService {
  constructor(
    private readonly repository: ExpensesRepository,
    private readonly context: WeddingContextService,
  ) {}
  async list(r: AuthenticatedRequest, f: ListExpensesQueryDto) {
    const w = await this.context.resolve(r);
    return this.repository.list(w.id, r.accessToken, f);
  }
  async create(r: AuthenticatedRequest, d: CreateExpenseDto) {
    const w = await this.context.resolve(r);
    return this.repository.create(w.id, r.accessToken, d);
  }
  async update(r: AuthenticatedRequest, id: string, d: UpdateExpenseDto) {
    if (!Object.keys(d).length) throw new BadRequestException('Informe um campo');
    const w = await this.context.resolve(r);
    return this.repository.update(id, w.id, r.accessToken, d);
  }
  paymentStatus(r: AuthenticatedRequest, id: string, d: UpdatePaymentStatusDto) {
    return this.update(r, id, { paid: d.paid });
  }
  async delete(r: AuthenticatedRequest, id: string) {
    const w = await this.context.resolve(r);
    await this.repository.delete(id, w.id, r.accessToken);
  }
}
