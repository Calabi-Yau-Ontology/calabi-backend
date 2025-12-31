import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AutocompleteRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  fragment!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
