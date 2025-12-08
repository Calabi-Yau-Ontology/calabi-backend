import { IsOptional, IsString, MinLength } from 'class-validator';

export class SuggestRequestDto {
  @IsString()
  @MinLength(1)
  text!: string;

  @IsOptional()
  @IsString()
  field?: string; // 'title' | 'description' 등

  @IsOptional()
  cursorPosition?: number;
}
