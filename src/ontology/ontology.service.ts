import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { NER_TO_CONCEPT_TYPE } from './constants/concept-mapping';
import { RELATIONS } from './constants/relations';
import { Event } from 'src/events/entities/event.entity';
import { NerResponseDto } from 'src/suggestions/dto/ner-response.dto';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class OntologyService {
  constructor(private readonly neo4j: Neo4jService) {}

  private toDateTimeString(date?: Date | null): string | null {
    return date ? date.toISOString() : null;
  }

  async upsertUser(user: User) {
    const cypher = `
      MERGE (u:User { id: $id })
      ON CREATE SET u.createdAt = datetime($createdAt)
      SET u.email = $email,
          u.updatedAt = datetime($updatedAt)
      RETURN u
    `;
    const now = new Date().toISOString();
    await this.neo4j.run(cypher, {
      id: user.id,
      email: user.email,
      createdAt: this.toDateTimeString(user.createdAt) ?? now,
      updatedAt: this.toDateTimeString(user.updatedAt) ?? now,
    });
  }

  async upsertEvent(event: Event) {
    const cypher = `
      MERGE (e:Event { eventId: $eventId })
      ON CREATE SET e.createdAt = datetime($createdAt)
      SET e.title = $title,
          e.description = $description,
          e.location = $location,
          e.startTime = datetime($startTime),
          e.endTime = CASE
            WHEN $endTime IS NULL THEN NULL
            ELSE datetime($endTime)
          END,
          e.updatedAt = datetime($updatedAt)
      RETURN e
    `;
    await this.neo4j.run(cypher, {
      eventId: event.id,
      title: event.title,
      description: event.description ?? null,
      location: event.location ?? null,
      startTime: this.toDateTimeString(event.startTime),
      endTime: this.toDateTimeString(event.endTime ?? null),
      createdAt: this.toDateTimeString(event.createdAt) ?? new Date().toISOString(),
      updatedAt: this.toDateTimeString(event.updatedAt) ?? new Date().toISOString(),
    });
  }

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
      MERGE (e)-[:${RELATIONS.MENTIONS}]->(c)
    `;
    await this.neo4j.run(cypher, { eventId, conceptName });
  }

  async linkUserToConcept(userId: string, conceptName: string) {
    const cypher = `
      MATCH (u:User {id: $userId})
      MATCH (c:Concept {name: $conceptName})
      MERGE (u)-[:${RELATIONS.RELATED_TO}]->(c)
    `;
    await this.neo4j.run(cypher, { userId, conceptName });
  }

  async linkUserToEvent(userId: string, eventId: string) {
    const cypher = `
      MATCH (u:User {id: $userId})
      MATCH (e:Event {eventId: $eventId})
      MERGE (u)-[:${RELATIONS.OWNS_EVENT}]->(e)
    `;
    await this.neo4j.run(cypher, { userId, eventId });
  }

  async clearEventConceptLinks(eventId: string) {
    const cypher = `
      MATCH (e:Event {eventId: $eventId})-[rel:MENTIONS]->(:Concept)
      DELETE rel
    `;
    await this.neo4j.run(cypher, { eventId });
  }

  async removeEvent(eventId: string) {
    const cypher = `
      MATCH (e:Event {eventId: $eventId})
      DETACH DELETE e
    `;
    await this.neo4j.run(cypher, { eventId });
  }

  async processEventOntology(user: User, event: Event, ner: NerResponseDto) {
    const entities = ner?.entities ?? [];

    await this.upsertUser(user);
    await this.upsertEvent(event);
    await this.linkUserToEvent(user.id, event.id);
    await this.clearEventConceptLinks(event.id);

    for (const ent of entities) {
      const conceptName = ent.text?.trim();
      if (!conceptName) {
        continue;
      }
      const conceptType = NER_TO_CONCEPT_TYPE[ent.label] ?? 'Concept';
      await this.upsertConcept(conceptName, conceptType);
      await this.linkEventToConcept(event.id, conceptName);
      await this.linkUserToConcept(user.id, conceptName);
    }
  }
}
