import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmOntologyRunDto {
  @ApiPropertyOptional({ description: '운영자 confirm 결과' })
  @IsOptional()
  confirm?: Record<string, any>;

  @ApiPropertyOptional({ description: 'propose ↔ confirm diff (선택)' })
  @IsOptional()
  diff?: Record<string, any>;

  @ApiPropertyOptional({ description: '운영자 메모' })
  @IsOptional()
  @IsString()
  notes?: string;
}
