import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import type { CurrentWeddingContext } from '../../common/types/authenticated-user.type';
import { MembersRepository } from './members.repository';

@Injectable()
export class WeddingContextService {
  constructor(private readonly repository: MembersRepository) {}

  async resolve(request: AuthenticatedRequest): Promise<CurrentWeddingContext> {
    if (request.wedding) return request.wedding;
    const memberships = await this.repository.findByUser(request.user.id, request.accessToken);
    if (!memberships.length) {
      throw new ForbiddenException('Usuário ainda não está vinculado a um casamento');
    }
    if (memberships.length > 1) {
      throw new ConflictException(
        'Usuário possui mais de um casamento; seleção ainda não suportada',
      );
    }
    request.wedding = { id: memberships[0].wedding_id, role: memberships[0].role };
    return request.wedding;
  }

  async requireOwner(request: AuthenticatedRequest) {
    const wedding = await this.resolve(request);
    if (wedding.role !== 'owner') {
      throw new ForbiddenException('Somente o responsável pelo casamento pode realizar esta ação');
    }
    return wedding;
  }
}
