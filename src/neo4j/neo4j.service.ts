import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Driver, QueryResult } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleDestroy {
  constructor(@Inject('NEO4J_DRIVER') private readonly driver: Driver) {}

  async onModuleDestroy() {
    await this.driver.close();
  }

  async run(
    query: string,
    params: Record<string, unknown> = {},
  ): Promise<QueryResult> {
    const session = this.driver.session();
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }
}
