import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AutocompleteRequestDto {
  @ApiProperty({
    description: '자동완성을 위한 검색어',
    minLength: 1,
    maxLength: 64,
    example: '클',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  fragment!: string;

  @ApiPropertyOptional({
    description: '최대 제안 개수',
    minimum: 1,
    maximum: 10,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
