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
import { CreateGuestDto } from './dto/create-guest.dto';
import { ListGuestsQueryDto } from './dto/list-guests-query.dto';
import { UpdateGuestStatusDto } from './dto/update-guest-status.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsService } from './guests.service';

@ApiTags('guests')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('guests')
export class GuestsController {
  constructor(private readonly service: GuestsService) {}
  @Get() list(@Req() r: AuthenticatedRequest, @Query() q: ListGuestsQueryDto) {
    return this.service.list(r, q);
  }
  @Post() create(@Req() r: AuthenticatedRequest, @Body() d: CreateGuestDto) {
    return this.service.create(r, d);
  }
  @Patch(':id') update(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateGuestDto,
  ) {
    return this.service.update(r, id, d);
  }
  @Patch(':id/status') status(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateGuestStatusDto,
  ) {
    return this.service.updateStatus(r, id, d);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) delete(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(r, id);
  }
}
