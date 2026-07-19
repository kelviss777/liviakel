import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';

interface SupabaseErrorLike {
  code?: string;
}

export function throwForSupabaseError(error: SupabaseErrorLike | null, fallback: string): void {
  if (!error) return;
  if (error.code === 'PGRST116') throw new NotFoundException('Registro não encontrado');
  if (error.code === '23505') throw new ConflictException('Já existe um registro com esses dados');
  throw new InternalServerErrorException(fallback);
}
