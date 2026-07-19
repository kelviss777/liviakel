import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import type { AuthenticatedRequest } from '../types/authenticated-request.type';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization) throw new UnauthorizedException('Token de acesso não informado');
    const [scheme, token, extra] = authorization.trim().split(/\s+/);
    if (scheme !== 'Bearer' || !token || extra) {
      throw new UnauthorizedException('Authorization deve usar o formato Bearer TOKEN');
    }
    const user = await this.supabase.getUser(token);
    if (!user) throw new UnauthorizedException('Token inválido ou sessão expirada');
    request.accessToken = token;
    request.user = { id: user.id, email: user.email ?? null, metadata: user.user_metadata ?? {} };
    return true;
  }
}
