import { ApiProperty } from '@nestjs/swagger';

export class DeleteResultDto {
  @ApiProperty({
    description: '삭제 성공 여부',
    example: true,
  })
  deleted!: boolean;
}
