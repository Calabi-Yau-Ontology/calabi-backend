import { ApiProperty } from '@nestjs/swagger';
import {
  CONCEPT_TYPE_LABELS,
  type ConceptType,
} from 'src/ontology/constants/concept.types';

export class AutocompleteSuggestionDto {
  @ApiProperty({
    description: '추천 표면형',
    example: '클라이밍',
  })
  surface!: string;

  @ApiProperty({
    description: '연결된 개념 이름',
    example: 'climbing',
    required: false,
  })
  conceptName?: string;

  @ApiProperty({
    description: '연결된 개념 타입',
    enum: CONCEPT_TYPE_LABELS,
    enumName: 'ConceptType',
    required: false,
  })
  conceptType?: ConceptType;

  @ApiProperty({
    description: '마지막 사용 일시',
    type: String,
    format: 'date-time',
    required: false,
    nullable: true,
  })
  lastUsedAt?: string | null;

  @ApiProperty({
    description: '사용 횟수',
    example: 12,
    required: false,
  })
  usageCount?: number;
}

export class AutocompleteResponseDto {
  @ApiProperty({ type: AutocompleteSuggestionDto, isArray: true })
  suggestions!: AutocompleteSuggestionDto[];
}
