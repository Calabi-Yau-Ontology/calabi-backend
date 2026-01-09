import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({
    description: '일정 제목',
    minLength: 1,
    maxLength: 255,
    example: '주간 회의',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: '일정 설명',
    example: '주간 진행 상황 공유',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: '시작 시각 (ISO8601)',
    example: '2025-01-01T09:00:00.000Z',
  })
  @IsDateString()
  startTime!: string;

  @ApiPropertyOptional({
    description: '종료 시각 (ISO8601)',
    example: '2025-01-01T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: '일정 위치',
    maxLength: 255,
    example: '본사 3층 회의실',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiProperty({
    description: '연결할 카테고리 ID',
    example: '8c05fe4b-34dc-45fd-9b31-c5fcf768f9d5',
  })
  @IsUUID()
  categoryId!: string;
}
