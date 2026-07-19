import { Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { WeddingContextService } from '../members/wedding-context.service';
import { DashboardRepository } from './dashboard.repository';
@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly context: WeddingContextService,
  ) {}
  async getDashboard(request: AuthenticatedRequest) {
    const wedding = await this.context.resolve(request);
    const data = await this.repository.getSnapshot(wedding.id, request.accessToken);
    const expected = data.expenses.reduce((sum, item) => sum + Number(item.value), 0);
    const paid = data.expenses
      .filter((item) => item.paid)
      .reduce((sum, item) => sum + Number(item.value), 0);
    return {
      wedding: data.wedding,
      guests: { total: data.guestsTotal, confirmed: data.guestsConfirmed },
      tasks: {
        total: data.tasksTotal,
        completed: data.tasksCompleted,
        completionPercentage: data.tasksTotal
          ? Math.round((data.tasksCompleted / data.tasksTotal) * 100)
          : 0,
        upcoming: data.upcomingTasks,
      },
      budget: { expected, paid, remaining: expected - paid },
    };
  }
}
