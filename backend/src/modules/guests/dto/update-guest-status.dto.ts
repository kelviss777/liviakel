import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { GuestStatus } from '../guests.types';
export class UpdateGuestStatusDto {
  @ApiProperty({ enum: GuestStatus }) @IsEnum(GuestStatus) status!: GuestStatus;
}
