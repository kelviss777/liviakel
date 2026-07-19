import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { VenueType } from '../venues.types';
export class ListVenuesQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(VenueType) type?: VenueType;
  @IsOptional() @IsBoolean() @Type(() => Boolean) favorite?: boolean;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
