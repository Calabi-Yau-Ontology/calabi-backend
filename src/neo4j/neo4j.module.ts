import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver } from 'neo4j-driver';
import { Neo4jService } from './neo4j.service';
import { NEO4J_SCHEMA_STATEMENTS } from './neo4j.schema';

@Global()
@Module({
  providers: [
    {
      provide: 'NEO4J_DRIVER',
      inject: [ConfigService],
      useFactory: (config: ConfigService): Driver => {
        const conf = config.get('neo4j');
        return neo4j.driver(
          conf.uri,
          neo4j.auth.basic(conf.user, conf.password),
        );
      },
    },
    Neo4jService,
  ],
  exports: ['NEO4J_DRIVER', Neo4jService],
})

export class Neo4jModule implements OnModuleInit {
  private readonly logger = new Logger(Neo4jModule.name);
  constructor(private readonly neo4j: Neo4jService) {}

  async onModuleInit() {
    for (const stmt of NEO4J_SCHEMA_STATEMENTS) {
      try {
        await this.neo4j.run(stmt, {});
      } catch (e: any) {
        this.logger.error(`Neo4j schema apply failed: ${e?.message ?? e}`, e?.stack);
        throw e;
      }
    }
    this.logger.log('Neo4j schema ensured.');
  }
}
