import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { NER_TO_CONCEPT_TYPE } from './constants/concept-mapping';
import { Event } from 'src/events/entities/event.entity';
import { NerResponseDto } from 'src/suggestions/dto/ner-response.dto';

@Injectable()
export class OntologyService {
  constructor(private readonly neo4j: Neo4jService) {}

  async upsertConcept(name: string, type: string) {
    const cypher = `
      MERGE (c:Concept:${type} { name: $name })
      ON CREATE SET c.createdAt = datetime()
      RETURN c
    `;
    return this.neo4j.run(cypher, { name });
  }

  async linkEventToConcept(eventId: string, conceptName: string) {
    const cypher = `
      MATCH (e:Event {eventId: $eventId})
      MATCH (c:Concept {name: $conceptName})
      MERGE (e)-[:MENTIONS]->(c)
    `;
    await this.neo4j.run(cypher, { eventId, conceptName });
  }

  async linkUserToConcept(userId: string, conceptName: string) {
    const cypher = `
      MATCH (u:User {id: $userId})
      MATCH (c:Concept {name: $conceptName})
      MERGE (u)-[:RELATED_TO]->(c)
    `;
    await this.neo4j.run(cypher, { userId, conceptName });
  }

  async processEventOntology(userId: string, event: Event, ner: NerResponseDto) {
    console.log('Processing ontology for event:', event.id);
    console.log('NER result:', ner);
    for (const ent of ner.entities) {
      const conceptType = NER_TO_CONCEPT_TYPE[ent.label] ?? 'Concept';
      await this.upsertConcept(ent.text, conceptType);
      await this.linkEventToConcept(event.id, ent.text);
      await this.linkUserToConcept(userId, ent.text);
    }
  }
}
