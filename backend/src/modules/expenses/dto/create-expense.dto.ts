import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { ExpenseCategory } from '../expenses.types';
export class CreateExpenseDto {
  @ApiProperty() @IsString() @Length(1, 160) name!: string;
  @ApiProperty({ enum: ExpenseCategory }) @IsEnum(ExpenseCategory) category!: ExpenseCategory;
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value!: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() paid?: boolean = false;
}
