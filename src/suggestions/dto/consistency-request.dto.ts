import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class ConsistencyCheckRequestDto {
  @ApiPropertyOptional({
    description: '추천을 수행할 일정 ID (제공 시 저장된 NER을 사용)',
    example: '8c05fe4b-34dc-45fd-9b31-c5fcf768f9d5',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({
    description: '일관성 검사를 수행할 텍스트',
    minLength: 1,
    example: '화랑과 연말 climbing',
  })
  @ValidateIf((dto) => !dto.eventId)
  @IsString()
  @MinLength(1)
  text?: string;
}
