import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class UnclassifiedQueryDto {
  @ApiPropertyOptional({
    description: '최근 사용 기준(ISO datetime)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, {
    message: 'since must be RFC3339 with time and timezone',
  })
  since?: string;

  @ApiPropertyOptional({ description: '이벤트당 미분류 멘션 최소 개수', example: 1 })
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
