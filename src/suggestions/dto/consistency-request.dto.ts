import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConsistencyCheckRequestDto {
  @ApiProperty({
    description: '일관성 검사를 수행할 텍스트',
    minLength: 1,
    example: '화랑과 연말 climbing',
  })
  @IsString()
  @MinLength(1)
  text!: string;
}
