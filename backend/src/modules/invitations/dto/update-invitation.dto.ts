import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { InvitationStatus } from '../invitations.types';
export class UpdateInvitationDto {
  @ApiProperty({ enum: InvitationStatus }) @IsEnum(InvitationStatus) status!: InvitationStatus;
}
