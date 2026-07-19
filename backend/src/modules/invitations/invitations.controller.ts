import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { ListInvitationsQueryDto } from './dto/list-invitations-query.dto';
import { InvitationsService } from './invitations.service';
@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}
  @Get() list(@Req() r: AuthenticatedRequest, @Query() q: ListInvitationsQueryDto) {
    return this.service.list(r, q);
  }
  @Post() create(@Req() r: AuthenticatedRequest, @Body() d: CreateInvitationDto) {
    return this.service.create(r, d);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) delete(
    @Req() r: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.delete(r, id);
  }
}
