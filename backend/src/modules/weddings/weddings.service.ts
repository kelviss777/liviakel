import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { WeddingContextService } from '../members/wedding-context.service';
import type { UpdateWeddingDto } from './dto/update-wedding.dto';
import { WeddingsRepository } from './weddings.repository';

@Injectable()
export class WeddingsService {
  constructor(
    private readonly repository: WeddingsRepository,
    private readonly context: WeddingContextService,
  ) {}

  async getCurrent(request: AuthenticatedRequest) {
    const wedding = await this.context.resolve(request);
    return this.repository.findCurrent(wedding.id, request.accessToken);
  }

  async updateCurrent(request: AuthenticatedRequest, input: UpdateWeddingDto) {
    if (!Object.keys(input).length) throw new BadRequestException('Informe um campo');
    const wedding = await this.context.resolve(request);
    return this.repository.updateCurrent(wedding.id, request.accessToken, input);
  }
}
