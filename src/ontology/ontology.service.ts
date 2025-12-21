import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { Event } from 'src/events/entities/event.entity';
import { User } from 'src/users/entities/user.entity';
import { NerResponseDto } from 'src/suggestions/dto/ner-response.dto';

import { NER_TO_CONCEPT_TYPE } from './constants/concept-mapping';
import { RELATIONS } from './constants/relations';
import { ExpansionService } from './expansion/expansion.service';

const CONCEPT_TYPE_LABELS = ['ActivityType', 'Location', 'Person', 'Project', 'Interest'] as const;
type ConceptType = (typeof CONCEPT_TYPE_LABELS)[number];

@Injectable()
export class OntologyService {
  private readonly logger = new Logger(OntologyService.name);

  constructor(
    private readonly neo4j: Neo4jService,
    private readonly expansionService: ExpansionService,
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
          e.endTime = CASE WHEN $endTime IS NULL THEN NULL ELSE datetime($endTime) END,
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

  /**
   * canonical_en (Concept.name) 기반 upsert
   * - MERGE key는 name 단 하나 (결정론)
   * - type은 라벨(Label:Activity 등)을 매핑한 ConceptType(LabelClass)만 사용
   * - provenance는 provenance로만 저장 (덮어쓸지 append할지는 정책인데, 지금은 "최신값"으로 둠)
   */
  async upsertConceptWithProps(
    name: string, // canonical_en
    type: ConceptType,
    props?: Record<string, any>,
  ) {
    const cypher = `
      MERGE (c:Concept:${type} { name: $name })
      ON CREATE SET
        c.createdAt = datetime(),
        c.source = COALESCE($source, c.source),
        c.updatedAt = datetime()
      ON MATCH SET
        c.source = COALESCE($source, c.source),
        c.updatedAt = datetime()
      SET c += $props
      RETURN c
    `;
    return this.neo4j.run(cypher, {
      name,
      source: props?.source ?? 'ml',
      props: props ?? {},
    });
  }

  async linkEventToConcept(eventId: string, conceptName: string) {
    const cypher = `
      MATCH (e:Event { eventId: $eventId })
      MATCH (c:Concept { name: $conceptName })
      MERGE (e)-[:${RELATIONS.MENTIONS}]->(c)
    `;
    await this.neo4j.run(cypher, { eventId, conceptName });
  }

  async linkUserToConcept(userId: string, conceptName: string) {
    const cypher = `
      MATCH (u:User { id: $userId })
      MATCH (c:Concept { name: $conceptName })
      MERGE (u)-[:${RELATIONS.RELATED_TO}]->(c)
    `;
    await this.neo4j.run(cypher, { userId, conceptName });
  }

  async linkUserToEvent(userId: string, eventId: string) {
    const cypher = `
      MATCH (u:User { id: $userId })
      MATCH (e:Event { eventId: $eventId })
      MERGE (u)-[:${RELATIONS.OWNS_EVENT}]->(e)
    `;
    await this.neo4j.run(cypher, { userId, eventId });
  }

  async clearEventConceptLinks(eventId: string) {
    const cypher = `
      MATCH (e:Event { eventId: $eventId })-[rel:${RELATIONS.MENTIONS}]->(:Concept)
      DELETE rel
    `;
    await this.neo4j.run(cypher, { eventId });
  }

  async removeEvent(eventId: string) {
    const cypher = `
      MATCH (e:Event { eventId: $eventId })
      DETACH DELETE e
    `;
    await this.neo4j.run(cypher, { eventId });
  }

  /**
   * 핵심 파이프라인:
   * - ner.mentions 에서 label 허용되는 것만
   * - Concept.name은 무조건 canonical.en
   * - Concept upsert 후 Event/User 연결
   * - 그리고 ExpansionService로 “name 기준 1회 확장” 트리거
   */
  async processEventOntology(user: User, event: Event, ner: NerResponseDto) {
    const mentions = ner?.mentions ?? [];

    await this.upsertUser(user);
    await this.upsertEvent(event);
    await this.linkUserToEvent(user.id, event.id);
    await this.clearEventConceptLinks(event.id);

    for (const m of mentions) {
      const label = m?.ner?.label;
      const conceptType = NER_TO_CONCEPT_TYPE[label] ?? 'None';
      if (conceptType === 'None') continue;

      const canonicalName = m?.canonical?.en?.trim(); // Concept.name
      if (!canonicalName) continue;

      const provenance = m?.surface?.trim();

      await this.upsertConceptWithProps(canonicalName, conceptType as ConceptType, {
        provenance: provenance ?? null,
        source: 'ml',
      });

      await this.linkEventToConcept(event.id, canonicalName);
      await this.linkUserToConcept(user.id, canonicalName);

      // 결정론 확장(중복 호출 안전)
      try {
        await this.expansionService.expandConceptByName(canonicalName);
      } catch (e: any) {
        this.logger.warn(
          `Wikidata expansion skipped for "${canonicalName}": ${e?.message ?? e}`,
        );
      }
    }
  }
}
