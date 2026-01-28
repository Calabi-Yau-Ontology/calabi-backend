import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { Event } from 'src/events/entities/event.entity';
import { User } from 'src/users/entities/user.entity';
import { NERResponseDto } from 'src/suggestions/dto/ner-response.dto';
import { normalizeSurfaceForm } from 'src/common/utils/text-normalize';

import {
  ConceptType,
  NER_TO_CONCEPT_TYPE,
  isAllowedNERLabel,
} from './constants/concept.types';
import { RELATIONS } from './constants/relations';
import { ExpansionService } from './expansion/expansion.service';
import { OntologyAutoClassifyService } from './ontology-auto-classify.service';

@Injectable()
export class OntologyService {
  constructor(
    private readonly neo4j: Neo4jService,
    private readonly config: ConfigService,
    private readonly expansionService: ExpansionService,
    private readonly autoClassifyService: OntologyAutoClassifyService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public upsert/link operations
  // ---------------------------------------------------------------------------

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

  async upsertEvent(event: Event, options?: { requireExisting?: boolean }) {
    const params = {
      eventId: event.id,
      title: event.title,
      description: event.description ?? null,
      location: event.location ?? null,
      startTime: this.toDateTimeString(event.startTime),
      endTime: this.toDateTimeString(event.endTime ?? null),
      createdAt:
        this.toDateTimeString(event.createdAt) ?? new Date().toISOString(),
      updatedAt:
        this.toDateTimeString(event.updatedAt) ?? new Date().toISOString(),
    };

    if (options?.requireExisting) {
      const cypher = `
        MATCH (e:Event { eventId: $eventId })
        SET e.title = $title,
            e.description = $description,
            e.location = $location,
            e.startTime = datetime($startTime),
            e.endTime = CASE WHEN $endTime IS NULL THEN NULL ELSE datetime($endTime) END,
            e.updatedAt = datetime($updatedAt)
        RETURN e
      `;
      const result = await this.neo4j.run(cypher, params);
      if (!result.records.length) {
        throw new NotFoundException(
          `Event node (${event.id}) not found in Neo4j for update`,
        );
      }
      return result;
    }

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
    return this.neo4j.run(cypher, params);
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
      MERGE (c:Concept:${type} { name: $name, type: $type })
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
      type,
      source: props?.source ?? 'ml',
      props: props ?? {},
    });
  }

  async linkEventToConcept(
    eventId: string,
    conceptName: string,
    conceptType: ConceptType,
  ) {
    const cypher = `
      MATCH (e:Event { eventId: $eventId })
      MATCH (c:Concept { name: $conceptName, type: $conceptType })
      MERGE (e)-[:${RELATIONS.MENTIONS}]->(c)
    `;
    await this.neo4j.run(cypher, { eventId, conceptName, conceptType });
  }

  async linkUserToConcept(
    userId: string,
    conceptName: string,
    conceptType: ConceptType,
  ) {
    const cypher = `
      MATCH (u:User { id: $userId })
      MATCH (c:Concept { name: $conceptName, type: $conceptType })
      MERGE (u)-[:${RELATIONS.RELATED_TO}]->(c)
    `;
    await this.neo4j.run(cypher, { userId, conceptName, conceptType });
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
  async processEventOntology(
    user: User,
    event: Event,
    ner: NERResponseDto,
    options?: { mode?: 'create' | 'update' },
  ) {
    const mentions = ner?.mentions ?? [];
    const mode = options?.mode ?? 'create';

    await this.upsertUser(user);
    await this.upsertEvent(event, { requireExisting: mode === 'update' });
    await this.linkUserToEvent(user.id, event.id);
    await this.clearEventConceptLinks(event.id);

    const conceptMap = new Map<
      string,
      {
        canonicalName: string;
        conceptType: ConceptType;
        surface: string | null;
        span?: { start: number; end: number } | null;
      }
    >();

    for (const m of mentions) {
      const label = m?.ner?.label;
      if (!isAllowedNERLabel(label)) continue;
      const mappedType = NER_TO_CONCEPT_TYPE[label];

      const canonicalName = m?.canonical?.en?.trim();
      if (!canonicalName) continue;
      const conceptKey = `${mappedType}::${canonicalName}`;

      const span = m?.span ?? null;

      const existing = conceptMap.get(conceptKey);
      if (!existing) {
        conceptMap.set(conceptKey, {
          canonicalName,
          conceptType: mappedType,
          surface: m?.surface?.trim() ?? null,
          span,
        });
        continue;
      }

      if (!existing.surface && m?.surface) {
        existing.surface = m.surface.trim();
      }
      if (!existing.span && span) {
        existing.span = span;
      }

    }

    const concepts = Array.from(conceptMap.values()).map((value) => ({
      canonicalName: value.canonicalName,
      conceptType: value.conceptType,
      surface: value.surface,
      span: value.span ?? null,
    }));

    for (const { canonicalName, conceptType, surface } of concepts) {
      const conceptProps: Record<string, any> = {
        source: 'ml',
      };
      if (surface) {
        conceptProps.provenance = surface;
      }

      await this.upsertConceptWithProps(
        canonicalName,
        conceptType,
        conceptProps,
      );
      await this.linkEventToConcept(event.id, canonicalName, conceptType);
      await this.linkUserToConcept(user.id, canonicalName, conceptType);
      await this.recordSurfaceForm(
        user.id,
        event.id,
        canonicalName,
        conceptType,
        surface,
      );
    }

    await this.autoClassifyService.autoClassifyUnclassifiedConcepts({
      concepts,
      sourceText: event.title,
      normalizedTextEn: ner?.normalized_text_en ?? null,
    });

    for (const { canonicalName } of concepts) {
      if (!this.isWikidataExpansionEnabled()) break;

      void this.expansionService.expandConceptByName(canonicalName).catch(() => {
        // Intentionally swallow errors:
        // - Expansion is optional and should never break the ingestion pipeline.
        // - Details are handled inside ExpansionService logs/markers.
      });
    }
  }

  private isWikidataExpansionEnabled(): boolean {
    const enabled = this.config.get<boolean>('wikidata.expansionEnabled');
    return enabled === true;
  }

  private async recordSurfaceForm(
    userId: string,
    eventId: string,
    conceptName: string,
    conceptType: ConceptType,
    surface: string | null,
  ): Promise<void> {
    const normalized = normalizeSurfaceForm(surface ?? '');
    if (!normalized) return;

    const key = `${conceptType}::${conceptName}::${normalized}`;
    const now = new Date().toISOString();

    const params = {
      conceptName,
      conceptType,
      surface,
      normalized,
      key,
      now,
      userId,
      eventId,
    };

    await this.upsertSurfaceFormNode(params);
    await this.linkUserToSurfaceForm(params);
  }

  private async upsertSurfaceFormNode(
    params: SurfaceFormParams,
  ): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $conceptName, type: $conceptType })
      MERGE (sf:SurfaceForm { key: $key })
      ON CREATE SET
        sf.value = $surface,
        sf.normalized = $normalized,
        sf.createdAt = datetime($now),
        sf.updatedAt = datetime($now),
        sf.usageCount = 0,
        sf.conceptName = $conceptName,
        sf.conceptType = $conceptType
      SET
        sf.value = COALESCE($surface, sf.value),
        sf.updatedAt = datetime($now),
        sf.normalized = $normalized,
        sf.usageCount = COALESCE(sf.usageCount, 0) + 1,
        sf.lastUsedAt = datetime($now),
        sf.lastUsedBy = $userId,
        sf.lastUsedEventId = $eventId
      MERGE (sf)-[r:${RELATIONS.SURFACE_OF}]->(c)
      ON CREATE SET r.createdAt = datetime($now)
      SET r.updatedAt = datetime($now)
    `;
    await this.neo4j.run(cypher, params);
  }

  private async linkUserToSurfaceForm(
    params: SurfaceFormParams,
  ): Promise<void> {
    const cypher = `
      MATCH (u:User { id: $userId })
      MATCH (sf:SurfaceForm { key: $key })
      MERGE (u)-[us:${RELATIONS.USED_SURFACE}]->(sf)
      ON CREATE SET
        us.createdAt = datetime($now),
        us.usageCount = 0
      SET
        us.updatedAt = datetime($now),
        us.usageCount = COALESCE(us.usageCount, 0) + 1,
        us.lastUsedAt = datetime($now),
        us.lastUsedEventId = $eventId
    `;
    await this.neo4j.run(cypher, params);
  }

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------

  private toDateTimeString(date?: Date | null): string | null {
    return date ? date.toISOString() : null;
  }
}

type SurfaceFormParams = {
  conceptName: string;
  conceptType: ConceptType;
  surface: string | null;
  normalized: string;
  key: string;
  now: string;
  userId: string;
  eventId: string;
};
