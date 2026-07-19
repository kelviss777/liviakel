import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { TaskCategory } from '../tasks.types';
export class CreateTaskDto {
  @ApiProperty() @IsString() @Length(1, 160) name!: string;
  @ApiProperty({ enum: TaskCategory }) @IsEnum(TaskCategory) category!: TaskCategory;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() due_date?: string | null;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() done?: boolean = false;
}
