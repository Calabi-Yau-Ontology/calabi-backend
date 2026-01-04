import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: '카테고리 이름',
    minLength: 1,
    maxLength: 100,
    example: '업무',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: '카테고리 색상',
    example: '#3b82f6',
  })
  @IsHexColor()
  color!: string;

  @ApiPropertyOptional({
    description: '카테고리 노출 여부',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({
    description: '기본 카테고리 여부',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
