import { Module } from '@nestjs/common';
import { OntologyService } from './ontology.service';
import { WikidataModule } from 'src/wikidata/wikidata.module';

@Module({
  imports:[WikidataModule],
  providers: [OntologyService],
  exports: [OntologyService],
})
export class OntologyModule {}
