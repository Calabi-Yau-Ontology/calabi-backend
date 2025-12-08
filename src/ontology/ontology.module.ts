import { Module } from '@nestjs/common';
import { OntologyService } from './ontology.service';

@Module({
  providers: [OntologyService],
  exports: [OntologyService],
})
export class OntologyModule {}
