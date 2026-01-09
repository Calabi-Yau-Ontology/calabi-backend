import { ApiProperty } from '@nestjs/swagger';
import {
  CONCEPT_TYPE_LABELS,
  type ConceptType,
} from 'src/ontology/constants/concept.types';

export type RecommendationReason = 'most_recent' | 'most_frequent';

export class SurfaceRecommendationDto {
  @ApiProperty({ enum: ['most_recent', 'most_frequent'] })
  reason!: RecommendationReason;

  @ApiProperty({ description: '추천 표면형', example: '클밍' })
  surface!: string;

  @ApiProperty({ description: '사용 횟수', example: 4, required: false })
  usageCount?: number;

  @ApiProperty({
    description: '마지막 사용 일시',
    type: String,
    format: 'date-time',
    required: false,
    nullable: true,
  })
  lastUsedAt?: string | null;
}

export class SpanDto {
  @ApiProperty({ example: 0 })
  start!: number;

  @ApiProperty({ example: 5 })
  end!: number;
}

export class ConsistencyRecommendationDto {
  @ApiProperty({ description: '표준 개념 이름', example: 'climbing' })
  canonicalName!: string;

  @ApiProperty({
    description: '개념 타입',
    enum: CONCEPT_TYPE_LABELS,
    enumName: 'ConceptType',
    required: false,
  })
  conceptType?: ConceptType;

  @ApiProperty({
    description: '입력된 표면형',
    nullable: true,
    required: false,
  })
  inputSurface?: string | null;

  @ApiProperty({
    description: '텍스트 내 위치',
    type: SpanDto,
    nullable: true,
    required: false,
  })
  span?: SpanDto | null;

  @ApiProperty({
    description: '최근 사용 추천',
    type: SurfaceRecommendationDto,
    nullable: true,
    required: false,
  })
  mostRecent?: SurfaceRecommendationDto | null;

  @ApiProperty({
    description: '가장 자주 사용한 추천',
    type: SurfaceRecommendationDto,
    nullable: true,
    required: false,
  })
  mostFrequent?: SurfaceRecommendationDto | null;
}

export class ConsistencyCheckResponseDto {
  @ApiProperty({ type: ConsistencyRecommendationDto, isArray: true })
  results!: ConsistencyRecommendationDto[];
}
