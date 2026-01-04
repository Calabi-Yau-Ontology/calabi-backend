import { ApiProperty } from '@nestjs/swagger';

export class HealthStatusDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({
    description: 'Neo4j 연결 상태',
    example: true,
  })
  neo4j!: boolean;
}
