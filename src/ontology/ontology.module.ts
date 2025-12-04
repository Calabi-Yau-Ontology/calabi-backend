import { Module } from '@nestjs/common';
import { OntologyService } from './ontology.service';

@Module({
  providers: [OntologyService]
})
export class OntologyModule {}
