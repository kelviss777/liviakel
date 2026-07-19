import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
export class UpdateVenueFavoriteDto {
  @ApiProperty() @IsBoolean() favorite!: boolean;
}
