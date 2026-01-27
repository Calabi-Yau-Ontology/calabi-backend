import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OntologyService } from './ontology.service';
import { Neo4jModule } from 'src/neo4j/neo4j.module';
import { WikidataModule } from 'src/wikidata/wikidata.module';
import { ExpansionService } from './expansion/expansion.service';
import { UsersModule } from 'src/users/users.module';
import { SuggestionsModule } from 'src/suggestions/suggestions.module';
import { Event } from 'src/events/entities/event.entity';
import { OntologyProcessor } from './ontology.processor';
import { ONTOLOGY_QUEUE_NAME } from './types/ontology-queue-job';
import { OntologyRun } from './entities/ontology-run.entity';
import { OntologyRunService } from './ontology-run.service';
import { OntologyAdminService } from './ontology-admin.service';
import { OntologyController } from './ontology.controller';

@Module({
  imports: [
    Neo4jModule,
    WikidataModule,
    UsersModule,
    SuggestionsModule,
    TypeOrmModule.forFeature([Event, OntologyRun]),
    BullModule.registerQueue({ name: ONTOLOGY_QUEUE_NAME }),
  ],
  providers: [
    OntologyService,
    ExpansionService,
    OntologyProcessor,
    OntologyRunService,
    OntologyAdminService,
  ],
  controllers: [OntologyController],
  exports: [OntologyService, ExpansionService],
})
export class OntologyModule {}
