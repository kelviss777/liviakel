import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TaskCategory } from '../tasks.types';
export class ListTasksQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(TaskCategory) category?: TaskCategory;
  @IsOptional() @IsBoolean() @Type(() => Boolean) done?: boolean;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
