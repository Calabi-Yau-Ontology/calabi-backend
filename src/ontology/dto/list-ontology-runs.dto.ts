import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ONTOLOGY_RUN_KINDS,
  ONTOLOGY_RUN_STATUSES,
} from '../constants/ontology-run.constants';

export class ListOntologyRunsDto {
  @ApiPropertyOptional({
    description: 'Run 종류 필터',
    enum: ONTOLOGY_RUN_KINDS,
  })
  @IsOptional()
  @IsString()
  @IsIn(ONTOLOGY_RUN_KINDS)
  kind?: string;

  @ApiPropertyOptional({
    description: 'Run 상태 필터',
    enum: ONTOLOGY_RUN_STATUSES,
  })
  @IsOptional()
  @IsString()
  @IsIn(ONTOLOGY_RUN_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: '조회 offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: '조회 limit', example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
