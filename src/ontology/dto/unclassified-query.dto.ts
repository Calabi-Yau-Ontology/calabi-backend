import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CONCEPT_TYPE_LABELS } from '../constants/concept.types';
import type { ConceptType } from '../constants/concept.types';

export class UnclassifiedQueryDto {
  @ApiPropertyOptional({
    description: 'Concept type 필터 (예: Activity, Location, Person)',
    enum: CONCEPT_TYPE_LABELS,
  })
  @IsOptional()
  @IsString()
  @IsIn(CONCEPT_TYPE_LABELS)
  conceptType?: ConceptType;

  @ApiPropertyOptional({
    description: '최근 사용 기준(ISO datetime)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  @Matches(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    {
      message: 'since must be RFC3339 with time and timezone',
    },
  )
  since?: string;

  @ApiPropertyOptional({ description: '최소 멘션 횟수', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minMentions?: number;

  @ApiPropertyOptional({ description: '조회 limit', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
