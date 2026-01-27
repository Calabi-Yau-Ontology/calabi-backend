import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OClassUpsertDto {
  @ApiProperty({ description: 'OClass id', example: 'PhysicalActivity' })
  @IsString()
  id!: string;

  @ApiPropertyOptional({ description: '한글 라벨' })
  @IsOptional()
  @IsString()
  labelKo?: string;

  @ApiPropertyOptional({ description: '영문 라벨' })
  @IsOptional()
  @IsString()
  labelEn?: string;

  @ApiPropertyOptional({ description: 'Facet (Activity/Location/...)' })
  @IsOptional()
  @IsString()
  facet?: string;

  @ApiPropertyOptional({ description: 'Kind (Category 등)' })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiPropertyOptional({ description: 'Root 여부' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRoot?: boolean;

  @ApiPropertyOptional({ description: '설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '상태' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'seedVersion' })
  @IsOptional()
  @IsString()
  seedVersion?: string;
}

export class SubclassEdgeUpsertDto {
  @ApiProperty({ description: '자식 OClass id' })
  @IsString()
  childId!: string;

  @ApiProperty({ description: '부모 OClass id' })
  @IsString()
  parentId!: string;
}

export class ClassificationUpsertDto {
  @ApiProperty({ description: 'Concept type', example: 'Activity' })
  @IsString()
  conceptType!: string;

  @ApiProperty({ description: 'Concept name', example: 'climbing' })
  @IsString()
  conceptName!: string;

  @ApiProperty({ description: 'OClass id', example: 'PhysicalActivity' })
  @IsString()
  oClassId!: string;

  @ApiPropertyOptional({ description: 'source', enum: ['llm', 'human'] })
  @IsOptional()
  @IsString()
  @IsIn(['llm', 'human'])
  source?: 'llm' | 'human';

  @ApiPropertyOptional({ description: 'confidence (0~1)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @ApiPropertyOptional({ description: '결정 시각 (RFC3339)' })
  @IsOptional()
  @IsDateString()
  decidedAt?: string;

  @ApiPropertyOptional({ description: 'active 여부' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class ApplyOntologyRunDto {
  @ApiPropertyOptional({ type: [OClassUpsertDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OClassUpsertDto)
  oClassesUpsert?: OClassUpsertDto[];

  @ApiPropertyOptional({ type: [SubclassEdgeUpsertDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SubclassEdgeUpsertDto)
  subclassEdgesUpsert?: SubclassEdgeUpsertDto[];

  @ApiPropertyOptional({ type: [ClassificationUpsertDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ClassificationUpsertDto)
  classificationsUpsert?: ClassificationUpsertDto[];

  @ApiPropertyOptional({
    description:
      '기존 active CLASSIFIED_AS 관계를 비활성화 후 재분류 (default: true)',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  replaceActive?: boolean;
}
