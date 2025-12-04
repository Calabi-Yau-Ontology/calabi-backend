import { Controller, Get } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';

@Controller('health')
export class HealthController {
  constructor(private readonly neo4jService: Neo4jService) {}

  @Get()
  async healthCheck() {
    // Neo4j 간단 쿼리
    const result = await this.neo4jService.run('RETURN 1 AS ok');
    const record = result.records[0];
    const ok = record.get('ok');

    return {
      status: 'ok',
      neo4j: ok === 1,
    };
  }
}
