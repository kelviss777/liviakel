export interface AuthenticatedUser {
  id: string;
  email: string | null;
  metadata: Record<string, unknown>;
}

export interface CurrentWeddingContext {
  id: string;
  role: 'owner' | 'partner';
}
