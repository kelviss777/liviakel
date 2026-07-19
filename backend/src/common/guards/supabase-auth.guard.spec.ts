import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

describe('SupabaseAuthGuard', () => {
  const supabase = { getUser: jest.fn() };
  const guard = new SupabaseAuthGuard(supabase as never);
  function context(authorization?: string): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
    } as ExecutionContext;
  }
  beforeEach(() => jest.clearAllMocks());
  it('retorna 401 sem token', async () => {
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(supabase.getUser).not.toHaveBeenCalled();
  });
  it('retorna 401 com header inválido', async () => {
    await expect(guard.canActivate(context('Basic token'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(supabase.getUser).not.toHaveBeenCalled();
  });
});
