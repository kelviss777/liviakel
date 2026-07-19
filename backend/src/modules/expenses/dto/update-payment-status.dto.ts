import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
export class UpdatePaymentStatusDto {
  @ApiProperty() @IsBoolean() paid!: boolean;
}
