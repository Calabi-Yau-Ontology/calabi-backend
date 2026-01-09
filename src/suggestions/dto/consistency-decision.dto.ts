import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CONCEPT_TYPE_LABELS,
  type ConceptType,
} from 'src/ontology/constants/concept.types';

export enum ConsistencyDecisionAction {
  Applied = 'applied',
  Ignored = 'ignored',
}

export class ConsistencyDecisionPairDto {
  @ApiProperty({ description: '표준 개념 이름', example: 'climbing' })
  @IsString()
  @MinLength(1)
  canonicalName!: string;

  @ApiProperty({
    description: '개념 타입',
    enum: CONCEPT_TYPE_LABELS,
    enumName: 'ConceptType',
  })
  @IsString()
  conceptType!: ConceptType;

  @ApiProperty({ description: '반영한 표면형', example: '클라이밍' })
  @IsString()
  @MinLength(1)
  appliedSurface!: string;
}

export class ConsistencyDecisionRequestDto {
  @ApiProperty({
    description: '결정을 반영할 일정 ID',
    example: '8c05fe4b-34dc-45fd-9b31-c5fcf768f9d5',
  })
  @IsUUID()
  eventId!: string;

  @ApiProperty({
    description: '추천 반영 여부',
    enum: ConsistencyDecisionAction,
    example: ConsistencyDecisionAction.Applied,
  })
  @IsEnum(ConsistencyDecisionAction)
  action!: ConsistencyDecisionAction;

  @ApiPropertyOptional({
    description: '반영 전 일정 제목',
    example: '화랑과 연말 climbing',
  })
  @ValidateIf((dto) => dto.action === ConsistencyDecisionAction.Applied)
  @IsString()
  @MinLength(1)
  beforeTitle?: string;

  @ApiPropertyOptional({
    description: '반영 후 일정 제목',
    example: '화랑과 연말 클라이밍',
  })
  @ValidateIf((dto) => dto.action === ConsistencyDecisionAction.Applied)
  @IsString()
  @MinLength(1)
  afterTitle?: string;

  @ApiPropertyOptional({
    description: '추천 반영 pair 목록',
    type: ConsistencyDecisionPairDto,
    isArray: true,
  })
  @ValidateIf((dto) => dto.action === ConsistencyDecisionAction.Applied)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsistencyDecisionPairDto)
  pairs?: ConsistencyDecisionPairDto[];
}

export class ConsistencyDecisionResponseDto {
  @ApiProperty({ description: '처리 완료 여부', example: true })
  acknowledged!: boolean;
}
