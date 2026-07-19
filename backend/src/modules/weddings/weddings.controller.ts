import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { UpdateWeddingDto } from './dto/update-wedding.dto';
import { WeddingsService } from './weddings.service';

@ApiTags('weddings')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('weddings')
export class WeddingsController {
  constructor(private readonly service: WeddingsService) {}
  @Get('current') getCurrent(@Req() request: AuthenticatedRequest) {
    return this.service.getCurrent(request);
  }
  @Patch('current') update(@Req() request: AuthenticatedRequest, @Body() input: UpdateWeddingDto) {
    return this.service.updateCurrent(request, input);
  }
}
