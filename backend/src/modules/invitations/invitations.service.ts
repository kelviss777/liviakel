import { ConflictException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { SupabaseAdminService } from '../../infrastructure/supabase/supabase-admin.service';
import { WeddingContextService } from '../members/wedding-context.service';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import type { ListInvitationsQueryDto } from './dto/list-invitations-query.dto';
import { InvitationsRepository } from './invitations.repository';
@Injectable()
export class InvitationsService {
  constructor(
    private readonly repository: InvitationsRepository,
    private readonly context: WeddingContextService,
    private readonly admin: SupabaseAdminService,
  ) {}
  async list(r: AuthenticatedRequest, f: ListInvitationsQueryDto) {
    const w = await this.context.requireOwner(r);
    return this.repository.list(w.id, r.accessToken, f);
  }
  async create(r: AuthenticatedRequest, input: CreateInvitationDto) {
    const w = await this.context.requireOwner(r);
    const email = input.email.trim().toLowerCase();
    if (r.user.email?.toLowerCase() === email)
      throw new ConflictException('Você não pode convidar o próprio e-mail');
    if (await this.repository.findPendingByEmail(w.id, r.accessToken, email)) {
      throw new ConflictException('Já existe um convite pendente para este e-mail');
    }
    const invitation = await this.repository.create(w.id, r.accessToken, email, r.user.id);
    if (!this.admin.isConfigured) {
      return {
        invitation,
        emailSent: false,
        message: 'Convite registrado, mas o envio de e-mail administrativo não está configurado',
      };
    }
    try {
      await this.admin.inviteUserByEmail(email);
      return { invitation, emailSent: true, message: 'Convite criado e e-mail enviado' };
    } catch {
      return {
        invitation,
        emailSent: false,
        message: 'Convite registrado, mas o provedor não conseguiu enviar o e-mail',
      };
    }
  }
  async delete(r: AuthenticatedRequest, id: string) {
    const w = await this.context.requireOwner(r);
    await this.repository.delete(id, w.id, r.accessToken);
  }
}
