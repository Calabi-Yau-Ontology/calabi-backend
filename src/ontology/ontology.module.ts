import { Module } from '@nestjs/common';
import { OntologyService } from './ontology.service';
import { Neo4jModule } from 'src/neo4j/neo4j.module';
import { WikidataModule } from 'src/wikidata/wikidata.module';
import { ExpansionService } from './expansion/expansion.service';

@Module({
  imports: [Neo4jModule, WikidataModule],
  providers: [OntologyService, ExpansionService],
  exports: [OntologyService, ExpansionService],
})
export class OntologyModule {}
