import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { GuestGroup, GuestStatus } from '../guests.types';

export class ListGuestsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(GuestStatus) status?: GuestStatus;
  @IsOptional() @IsEnum(GuestGroup) guest_group?: GuestGroup;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
