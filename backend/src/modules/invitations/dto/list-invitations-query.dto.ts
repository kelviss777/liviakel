import { IsEnum, IsOptional } from 'class-validator';
import { InvitationStatus } from '../invitations.types';
export class ListInvitationsQueryDto {
  @IsOptional() @IsEnum(InvitationStatus) status?: InvitationStatus;
}
