import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.id, email: user.email, metadata: user.metadata };
  }
}
