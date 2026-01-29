import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ONTOLOGY_RUN_KINDS } from '../constants/ontology-run.constants';
import type { OntologyRunKind } from '../constants/ontology-run.constants';

export class CreateOntologyRunDto {
  @ApiProperty({
    description: 'Run 종류',
    enum: ONTOLOGY_RUN_KINDS,
  })
  @IsString()
  @IsIn(ONTOLOGY_RUN_KINDS)
  kind!: OntologyRunKind;

  @ApiPropertyOptional({
    description: '입력 payload (CQ 목록 또는 concept 목록)',
  })
  @IsOptional()
  input?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Snapshot JSON' })
  @IsOptional()
  snapshot?: Record<string, any>;

  @ApiPropertyOptional({ description: 'LLM propose 원본 JSON' })
  @IsOptional()
  propose?: Record<string, any>;

  @ApiPropertyOptional({ description: '운영자 메모' })
  @IsOptional()
  @IsString()
  notes?: string;
}
