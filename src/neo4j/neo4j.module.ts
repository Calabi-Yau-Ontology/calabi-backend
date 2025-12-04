import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver } from 'neo4j-driver';
import { Neo4jService } from './neo4j.service';

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
export class Neo4jModule {}
