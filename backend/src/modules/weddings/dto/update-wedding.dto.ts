import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class UpdateWeddingDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  partner_one?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  partner_two?: string | null;

  @ApiPropertyOptional({ example: '2027-05-15', nullable: true })
  @IsOptional()
  @IsDateString()
  wedding_date?: string | null;
}
