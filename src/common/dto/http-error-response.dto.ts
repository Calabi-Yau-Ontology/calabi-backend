import { ApiProperty } from '@nestjs/swagger';

export class HttpErrorResponseDto {
  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 401,
  })
  statusCode!: number;

  @ApiProperty({
    description: '에러 설명',
    example: 'Unauthorized',
  })
  message!: string | string[];

  @ApiProperty({
    description: '에러 유형',
    example: 'Unauthorized',
    required: false,
  })
  error?: string;

}
