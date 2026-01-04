import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Neo4jService } from '../neo4j/neo4j.service';
import { HealthStatusDto } from './dto/health-status.dto';

@ApiTags('헬스체크')
@Controller('health')
export class HealthController {
  constructor(private readonly neo4jService: Neo4jService) {}

  @Get()
  @ApiOperation({
    summary: '헬스 체크',
    description: 'Neo4j 연결 상태를 포함한 서비스 상태를 반환합니다.',
  })
  @ApiOkResponse({ type: HealthStatusDto })
  async healthCheck(): Promise<HealthStatusDto> {
    const result = await this.neo4jService.run('RETURN 1 AS ok');
    const record = result.records[0];
    const ok = record.get('ok');

    return {
      status: 'ok',
      neo4j: ok === 1,
    };
  }
}
