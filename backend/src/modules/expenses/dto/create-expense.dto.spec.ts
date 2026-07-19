import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExpenseDto } from './create-expense.dto';
import { ExpenseCategory } from '../expenses.types';

describe('CreateExpenseDto', () => {
  it('aceita uma despesa válida', async () => {
    const dto = plainToInstance(CreateExpenseDto, {
      name: 'Buffet',
      category: ExpenseCategory.Buffet,
      value: 1500,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
  it('rejeita valor negativo', async () => {
    const dto = plainToInstance(CreateExpenseDto, {
      name: 'Buffet',
      category: ExpenseCategory.Buffet,
      value: -1,
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
