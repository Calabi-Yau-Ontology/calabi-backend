import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { NER_TO_CONCEPT_TYPE } from './constants/concept-mapping';
import { WikidataService } from 'src/wikidata/wikidata.service';
import { RELATIONS, RelationValue } from './constants/relations';
import { Event } from 'src/events/entities/event.entity';
import { NerResponseDto } from 'src/suggestions/dto/ner-response.dto';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class OntologyService {
  constructor(
    private readonly neo4j: Neo4jService,
    private readonly wikidata: WikidataService,
  ) {}

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

  async upsertConcept(
    name: string,
    type: string,
    opts?: { externalId?: string; source?: string },
  ) {
    const cypher = `
      MERGE (c:Concept:${type} { name: $name })
      ON CREATE SET
        c.createdAt = datetime()
      SET
        c.externalId = COALESCE($externalId, c.externalId),
        c.source = COALESCE($source, c.source),
        c.updatedAt = datetime()
      RETURN c
    `;

    await this.neo4j.run(cypher, {
      name,
      externalId: opts?.externalId ?? null,
      source: opts?.source ?? null,
    });
  }

  async expandConceptFromWikidata(name: string, type: string) {
    // 1) Concept 이미 externalId가 있다면, 재확장하지 않도록 early return (optional)
    const checkCypher = `
      MATCH (c:Concept:${type} {name: $name})
      RETURN c.externalId AS externalId
    `;
    const result = await this.neo4j.run(checkCypher, { name });
    const existing = result.records?.[0]?.get?.('externalId');
    if (existing) {
      // 이미 Wikidata 연동된 Concept라면 확장 스킵
      return;
    }

    // 2) Wikidata 검색
    const entity = await this.wikidata.searchEntity(name);
    if (!entity) return;

    const qid = entity.id; // Q번호

    // 3) Concept 노드에 externalId / source 업데이트
    await this.upsertConcept(name, type, {
      externalId: qid,
      source: 'wikidata',
    });

    // 4) 이웃 가져오기
    const neighbors = await this.wikidata.fetchNeighbors(qid);
    if (!neighbors.length) return;

    // 5) 이웃 Concept upsert + 관계 생성
    for (const nb of neighbors) {
      const neighborType = 'Concept'; // 일단 타입은 generic, 나중에 분류 가능

      await this.upsertConcept(nb.label, neighborType, {
        externalId: nb.id,
        source: 'wikidata',
      });

      let relation: RelationValue;
      if (nb.relation === 'INSTANCE_OF') relation = RELATIONS.INSTANCE_OF;
      else if (nb.relation === 'SUBCLASS_OF') relation = RELATIONS.SUBCLASS_OF;
      else if (nb.relation === 'HAS_PART') relation = RELATIONS.HAS_PART;
      else relation = RELATIONS.HAS_GOAL;

      await this.linkConceptToConcept(name, nb.label, relation);
    }
  }

  async linkConceptToConcept(
    fromName: string,
    toName: string,
    relation: RelationValue,
  ) {
    const cypher = `
      MATCH (c1:Concept {name: $fromName})
      MATCH (c2:Concept {name: $toName})
      MERGE (c1)-[r:${relation}]->(c2)
      RETURN r
    `;
    await this.neo4j.run(cypher, { fromName, toName });
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

      // Wikidata 확장 (best-effort)
      try {
        await this.expandConceptFromWikidata(conceptName, conceptType);
      } catch (e) {
        // 절대 메인 플로우 깨지지 않게 로그만
        console.error('Wikidata expansion failed', e);
      }
    }
  }
}
