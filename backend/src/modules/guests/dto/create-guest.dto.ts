import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { GuestGroup, GuestStatus } from '../guests.types';

export class CreateGuestDto {
  @ApiProperty() @IsString() @Length(1, 120) name!: string;
  @ApiProperty({ enum: GuestGroup }) @IsEnum(GuestGroup) guest_group!: GuestGroup;
  @ApiPropertyOptional({ enum: GuestStatus, default: GuestStatus.Pending })
  @IsOptional()
  @IsEnum(GuestStatus)
  status?: GuestStatus = GuestStatus.Pending;
}
