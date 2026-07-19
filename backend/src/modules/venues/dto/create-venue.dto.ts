import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { VenueType } from '../venues.types';
export class CreateVenueDto {
  @ApiProperty() @IsString() @Length(1, 120) name!: string;
  @ApiProperty({ enum: VenueType }) @IsEnum(VenueType) type!: VenueType;
  @ApiProperty() @IsString() @Length(1, 300) address!: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() favorite?: boolean = false;
}
