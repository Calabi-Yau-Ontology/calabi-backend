import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { Neo4jModule } from './neo4j/neo4j.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { OntologyModule } from './ontology/ontology.module';
import { HealthModule } from './health/health.module';
import { CategoriesModule } from './categories/categories.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'dev'
          ? '.env.dev'
          : process.env.NODE_ENV === 'prod'
            ? '.env.prod'
            : '.env.test',
      load: [configuration],
      validate,
    }),
    DatabaseModule,
    Neo4jModule,
    UsersModule,
    AuthModule,
    EventsModule,
    CategoriesModule,
    SuggestionsModule,
    OntologyModule,
    HealthModule,
    RedisModule,
  ],
})
export class AppModule {}
