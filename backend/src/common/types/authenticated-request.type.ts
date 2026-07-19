import type { Request } from 'express';
import type { AuthenticatedUser, CurrentWeddingContext } from './authenticated-user.type';

export interface AuthenticatedRequest extends Request {
  accessToken: string;
  user: AuthenticatedUser;
  wedding?: CurrentWeddingContext;
}
