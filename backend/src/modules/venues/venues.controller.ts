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
import { CreateVenueDto } from './dto/create-venue.dto';
import { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import { UpdateVenueFavoriteDto } from './dto/update-venue-favorite.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenuesService } from './venues.service';
@ApiTags('venues')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('venues')
export class VenuesController {
  constructor(private readonly service: VenuesService) {}
  @Get() list(@Req() r: AuthenticatedRequest, @Query() q: ListVenuesQueryDto) {
    return this.service.list(r, q);
  }
  @Post() create(@Req() r: AuthenticatedRequest, @Body() d: CreateVenueDto) {
    return this.service.create(r, d);
  }
  @Patch(':id') update(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateVenueDto,
  ) {
    return this.service.update(r, id, d);
  }
  @Patch(':id/favorite') favorite(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateVenueFavoriteDto,
  ) {
    return this.service.favorite(r, id, d);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) delete(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(r, id);
  }
}
