import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { WeddingContextService } from '../members/wedding-context.service';
import type { CreateVenueDto } from './dto/create-venue.dto';
import type { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import type { UpdateVenueFavoriteDto } from './dto/update-venue-favorite.dto';
import type { UpdateVenueDto } from './dto/update-venue.dto';
import { VenuesRepository } from './venues.repository';
@Injectable()
export class VenuesService {
  constructor(
    private readonly repository: VenuesRepository,
    private readonly context: WeddingContextService,
  ) {}
  async list(r: AuthenticatedRequest, f: ListVenuesQueryDto) {
    const w = await this.context.resolve(r);
    return this.repository.list(w.id, r.accessToken, f);
  }
  async create(r: AuthenticatedRequest, d: CreateVenueDto) {
    const w = await this.context.resolve(r);
    return this.repository.create(w.id, r.accessToken, d);
  }
  async update(r: AuthenticatedRequest, id: string, d: UpdateVenueDto) {
    if (!Object.keys(d).length) throw new BadRequestException('Informe um campo');
    const w = await this.context.resolve(r);
    return this.repository.update(id, w.id, r.accessToken, d);
  }
  favorite(r: AuthenticatedRequest, id: string, d: UpdateVenueFavoriteDto) {
    return this.update(r, id, { favorite: d.favorite });
  }
  async delete(r: AuthenticatedRequest, id: string) {
    const w = await this.context.resolve(r);
    await this.repository.delete(id, w.id, r.accessToken);
  }
}
