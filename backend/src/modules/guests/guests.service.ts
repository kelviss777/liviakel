import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { WeddingContextService } from '../members/wedding-context.service';
import type { CreateGuestDto } from './dto/create-guest.dto';
import type { ListGuestsQueryDto } from './dto/list-guests-query.dto';
import type { UpdateGuestStatusDto } from './dto/update-guest-status.dto';
import type { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsRepository } from './guests.repository';

@Injectable()
export class GuestsService {
  constructor(
    private readonly repository: GuestsRepository,
    private readonly context: WeddingContextService,
  ) {}
  async list(request: AuthenticatedRequest, filters: ListGuestsQueryDto) {
    const wedding = await this.context.resolve(request);
    return this.repository.list(wedding.id, request.accessToken, filters);
  }
  async create(request: AuthenticatedRequest, input: CreateGuestDto) {
    const wedding = await this.context.resolve(request);
    return this.repository.create(wedding.id, request.accessToken, input);
  }
  async update(request: AuthenticatedRequest, id: string, input: UpdateGuestDto) {
    if (!Object.keys(input).length) throw new BadRequestException('Informe um campo');
    const wedding = await this.context.resolve(request);
    return this.repository.update(id, wedding.id, request.accessToken, input);
  }
  updateStatus(request: AuthenticatedRequest, id: string, input: UpdateGuestStatusDto) {
    return this.update(request, id, { status: input.status });
  }
  async delete(request: AuthenticatedRequest, id: string) {
    const wedding = await this.context.resolve(request);
    await this.repository.delete(id, wedding.id, request.accessToken);
  }
}
