import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { ConceptType } from './constants/concept.types';
import { OntologyAdminService } from './ontology-admin.service';

type ClassifyConceptInput = {
  conceptKey: string;
  conceptType: ConceptType;
  conceptName: string;
  sourceText: string;
  normalizedTextEn?: string | null;
  surface?: string | null;
  span?: { start: number; end: number } | null;
};

type ClassifyRequestPayload = {
  concepts: ClassifyConceptInput[];
  snapshot: {
    oClasses: unknown[];
    subclassEdges: unknown[];
    seedVersion?: string[] | string | null;
  };
  mode: 'existing_only' | 'allow_new_leaf';
  eventId?: string | null;
  eventTitle?: string | null;
  eventNormalizedTextEn?: string | null;
};

type ClassifyResponsePayload = {
  ok?: boolean;
  classifications?: Array<{
    conceptKey: string;
    conceptType: ConceptType;
    conceptName: string;
    oClassId: string;
    confidence: number;
    rationale?: string | null;
  }>;
  eventActivities?: Array<{
    eventId?: string | null;
    oClassId: string;
    confidence: number;
    rationale?: string | null;
  }>;
  errors?: Array<Record<string, any>>;
};

const ML_CLASSIFY_TIMEOUT_MS = 5000;
@Injectable()
export class OntologyAutoClassifyService {
  private readonly logger = new Logger(OntologyAutoClassifyService.name);

  constructor(
    private readonly neo4j: Neo4jService,
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
    private readonly adminService: OntologyAdminService,
  ) {}

  async autoClassifyUnclassifiedConcepts(params: {
    eventId: string;
    eventTitle: string;
    concepts: Array<{
      canonicalName: string;
      conceptType: ConceptType;
      surface?: string | null;
      span?: { start: number; end: number } | null;
    }>;
    sourceText: string;
    normalizedTextEn?: string | null;
  }): Promise<void> {
    if (!this.isAutoClassifyEnabled()) return;

    const inputs: ClassifyConceptInput[] = params.concepts.map((c) => ({
      conceptKey: `${c.conceptType}::${c.canonicalName}`,
      conceptType: c.conceptType,
      conceptName: c.canonicalName,
      sourceText: params.sourceText,
      normalizedTextEn: params.normalizedTextEn ?? null,
      surface: c.surface ?? null,
      span: c.span ?? null,
    }));
    if (!inputs.length || !inputs.some((c) => this.isConceptAutoClassifiable(c.conceptType))) {
      await this.requestEventActivitiesOnly({
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        normalizedTextEn: params.normalizedTextEn ?? null,
        snapshot: null,
      });
      return;
    }
    const candidates = inputs.filter((c) =>
      this.isConceptAutoClassifiable(c.conceptType),
    );
    const targetConcepts = candidates.length ? candidates : inputs;

    const unclassified = await this.filterUnclassifiedConcepts(targetConcepts);
    if (!unclassified.length) {
      await this.requestEventActivitiesOnly({
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        normalizedTextEn: params.normalizedTextEn ?? null,
        snapshot: null,
      });
      return;
    }

    const snapshot = await this.adminService.getSnapshot();
    const availableFacets = new Set(
      (snapshot?.oClasses ?? [])
        .map((c: any) => this.normalizeFacet(c?.facet))
        .filter((facet): facet is string => !!facet),
    );
    const usableUnclassified = unclassified.filter((c) => {
      const facet = this.normalizeFacet(
        this.getFacetForConceptType(c.conceptType),
      );
      return facet ? availableFacets.has(facet) : false;
    });
    if (!usableUnclassified.length) {
      await this.requestEventActivitiesOnly({
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        normalizedTextEn: params.normalizedTextEn ?? null,
        snapshot,
      });
      return;
    }

    const conceptFacets = Array.from(
      new Set(
        usableUnclassified
          .map((c) => this.getFacetForConceptType(c.conceptType))
          .map((facet) => this.normalizeFacet(facet))
          .filter((facet): facet is string => Boolean(facet)),
      ),
    );
    const filteredSnapshot = this.buildSnapshotPayload(snapshot, [
      ...conceptFacets,
      'Activity',
    ]);
    if (!filteredSnapshot.oClasses.length) return;

    const payload: ClassifyRequestPayload = {
      concepts: usableUnclassified,
      snapshot: filteredSnapshot,
      mode: 'existing_only',
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      eventNormalizedTextEn: params.normalizedTextEn ?? null,
    };

    const response = await this.requestMlClassify(payload);
    if (!response) return;

    const classifications = response.classifications ?? [];
    const requestMap = new Map(
      usableUnclassified.map((c) => [
        c.conceptKey,
        { conceptType: c.conceptType, conceptName: c.conceptName },
      ]),
    );
    const appliedEvent = await this.applyEventActivities(
      response,
      params.eventId,
    );

    const filtered = classifications.filter((item) => {
      if (!item?.conceptKey) return false;
      const expected = requestMap.get(item.conceptKey);
      if (!expected) return false;
      return (
        item.conceptType === expected.conceptType &&
        item.conceptName === expected.conceptName
      );
    });
    if (!filtered.length) {
      if (!appliedEvent) {
        await this.requestEventActivitiesOnly({
          eventId: params.eventId,
          eventTitle: params.eventTitle,
          normalizedTextEn: params.normalizedTextEn ?? null,
          snapshot,
        });
      }
      return;
    }

    const threshold = this.getAutoClassifyMinConfidence();
    for (const item of filtered) {
      const confidence = item.confidence ?? 0;
      if (!item.oClassId || confidence < threshold) continue;
      const expectedFacet = this.getFacetForConceptType(item.conceptType);
      if (expectedFacet === 'Activity') continue;
      await this.classifyConceptByOClass({
        conceptName: item.conceptName,
        conceptType: item.conceptType,
        oClassId: item.oClassId,
        confidence,
        source: 'llm',
        reason: item.rationale ?? null,
        expectedFacet,
      });
    }
    if (!appliedEvent) {
      await this.requestEventActivitiesOnly({
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        normalizedTextEn: params.normalizedTextEn ?? null,
        snapshot,
      });
    }
  }

  private isAutoClassifyEnabled(): boolean {
    const enabled = this.config.get<boolean>('ontology.autoClassify.enabled');
    return enabled !== false;
  }

  private getAutoClassifyMinConfidence(): number {
    const value = this.config.get<number>('ontology.autoClassify.minConfidence');
    return typeof value === 'number' && !Number.isNaN(value) ? value : 0.85;
  }

  private async filterUnclassifiedConcepts(
    concepts: ClassifyConceptInput[],
  ): Promise<ClassifyConceptInput[]> {
    if (!concepts.length) return [];

    const cypher = `
      UNWIND $items AS item
      OPTIONAL MATCH (c:Concept { name: item.name, type: item.type })
      OPTIONAL MATCH (c)-[r:CLASSIFIED_AS]->(:OClass)
      WHERE coalesce(r.active, true) = true
      RETURN item.key AS key, count(r) AS activeCount
    `;

    const items = concepts.map((c) => ({
      key: c.conceptKey,
      name: c.conceptName,
      type: c.conceptType,
    }));

    const res = await this.neo4j.run(cypher, { items });
    const unclassifiedKeys = new Set<string>();

    for (const record of res.records) {
      const key = record.get('key') as string;
      const countValue = record.get('activeCount') as any;
      const activeCount =
        typeof countValue === 'number'
          ? countValue
          : typeof countValue?.toNumber === 'function'
            ? countValue.toNumber()
            : 0;
      if (activeCount === 0) {
        unclassifiedKeys.add(key);
      }
    }

    return concepts.filter((c) => unclassifiedKeys.has(c.conceptKey));
  }

  private async requestEventActivitiesOnly(params: {
    eventId: string;
    eventTitle: string;
    normalizedTextEn: string | null;
    snapshot: any | null;
  }): Promise<void> {
    const title = params.eventTitle?.trim();
    if (!title) return;

    const snapshot = params.snapshot ?? (await this.adminService.getSnapshot());
    const filteredSnapshot = this.buildSnapshotPayload(snapshot, ['Activity']);
    if (!filteredSnapshot.oClasses.length) return;

    const payload: ClassifyRequestPayload = {
      concepts: [
        {
          conceptKey: `Event::${params.eventId}`,
          conceptType: 'Activity',
          conceptName: title,
          sourceText: title,
          normalizedTextEn: params.normalizedTextEn ?? null,
        },
      ],
      snapshot: filteredSnapshot,
      mode: 'existing_only',
      eventId: params.eventId,
      eventTitle: title,
      eventNormalizedTextEn: params.normalizedTextEn ?? null,
    };

    const response = await this.requestMlClassify(payload);
    if (!response) return;
    await this.applyEventActivities(response, params.eventId);
  }

  private async applyEventActivities(
    response: ClassifyResponsePayload,
    eventId: string,
  ): Promise<boolean> {
    const threshold = this.getAutoClassifyMinConfidence();
    const activities = response.eventActivities ?? [];
    if (!activities.length) return false;

    let applied = false;
    for (const item of activities) {
      const confidence = item.confidence ?? 0;
      if (item.eventId && item.eventId !== eventId) continue;
      if (!item.oClassId || confidence < threshold) continue;
      await this.classifyEventByOClass({
        eventId,
        oClassId: item.oClassId,
        confidence,
        source: 'llm',
        reason: item.rationale ?? null,
      });
      applied = true;
    }
    return applied;
  }

  private buildSnapshotPayload(
    snapshot: any,
    facets?: string[],
  ): {
    oClasses: any[];
    subclassEdges: Array<{ childId: string; parentId: string }>;
    seedVersion: string | null;
  } {
    const rawClasses = Array.isArray(snapshot?.oClasses) ? snapshot.oClasses : [];
    const facetSet =
      Array.isArray(facets) && facets.length ? new Set(facets) : null;
    const filteredClasses = facetSet
      ? rawClasses.filter((c) => c?.facet && facetSet.has(c.facet))
      : rawClasses;

    const idSet = new Set(
      filteredClasses.map((c) => c?.id).filter((id): id is string => !!id),
    );

    const rawEdges = Array.isArray(snapshot?.subclassEdges)
      ? snapshot.subclassEdges
      : [];
    const subclassEdges = rawEdges
      .map((edge: any) => ({
        childId: edge.child ?? edge.childId,
        parentId: edge.parent ?? edge.parentId,
      }))
      .filter(
        (edge: any) => idSet.has(edge.childId) && idSet.has(edge.parentId),
      );

    const seedVersion = Array.isArray(snapshot?.seedVersions)
      ? snapshot.seedVersions[0] ?? null
      : snapshot?.seedVersions ?? null;

    return {
      oClasses: filteredClasses,
      subclassEdges,
      seedVersion,
    };
  }

  private isConceptAutoClassifiable(type: ConceptType): boolean {
    return this.getFacetForConceptType(type) !== 'Activity';
  }

  private getFacetForConceptType(type: ConceptType): string | null {
    const map: Record<ConceptType, string> = {
      Activity: 'Activity',
      Location: 'Location',
      Person: 'Person',
      Project: 'Project',
      Topic: 'Topic',
      Organization: 'Organization',
      Food: 'Food',
      Media: 'Media',
      Animal: 'Animal',
    };
    return map[type] ?? null;
  }

  private normalizeFacet(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length ? normalized : null;
  }

  private async requestMlClassify(
    payload: ClassifyRequestPayload,
  ): Promise<ClassifyResponsePayload | null> {
    const baseUrl = this.resolveMlBaseUrl();
    if (!baseUrl) return null;

    const url = `${baseUrl}/ontology/classify`;
    try {
      const response$ = this.httpService.post<ClassifyResponsePayload>(
        url,
        payload,
        { timeout: ML_CLASSIFY_TIMEOUT_MS },
      );
      const { data } = await firstValueFrom(response$);
      if (data?.ok === false) {
        this.logger.warn(
          `ML classify returned ok=false: ${JSON.stringify(data.errors ?? [])}`,
        );
      }
      return data ?? null;
    } catch (error: unknown) {
      const err = this.normalizeAxiosError(error);
      this.logger.warn(
        `ML classify request failed: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  private resolveMlBaseUrl(): string | null {
    const mlConfig = this.config.get<{ baseUrl?: string }>('ml');
    const baseUrl = mlConfig?.baseUrl?.trim() ?? '';
    return baseUrl.length ? baseUrl : null;
  }

  private normalizeAxiosError(error: unknown): AxiosError {
    if (isAxiosError(error)) {
      return error;
    }
    const message =
      error instanceof Error ? error.message : 'Unknown axios error';
    return new AxiosError(message);
  }

  private async classifyConceptByOClass(params: {
    conceptName: string;
    conceptType: ConceptType;
    oClassId: string;
    confidence: number;
    source: string;
    reason: string | null;
    expectedFacet: string | null;
  }): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $conceptName, type: $conceptType })
      MATCH (o:OClass { id: $oClassId })
      WHERE ($expectedFacet IS NULL OR o.facet = $expectedFacet)
      OPTIONAL MATCH (c)-[r:CLASSIFIED_AS]->(:OClass)
      WHERE coalesce(r.active, true) = true
      WITH c, o, collect(r) AS activeRels
      WITH c, o, activeRels,
           [r IN activeRels WHERE coalesce(r.source, '') IN ['llm', 'auto']
             AND coalesce(toFloat(r.confidence), -1) < $confidence] AS replaceable,
           [r IN activeRels WHERE NOT (coalesce(r.source, '') IN ['llm', 'auto']
             AND coalesce(toFloat(r.confidence), -1) < $confidence)] AS blocked
      WITH c, o, activeRels, replaceable, blocked,
           CASE
             WHEN size(activeRels) = 0 THEN true
             WHEN size(blocked) = 0 AND size(replaceable) > 0 THEN true
             ELSE false
           END AS allowReplace
      FOREACH (_ IN CASE WHEN allowReplace AND size(replaceable) > 0 THEN [1] ELSE [] END |
        FOREACH (old IN replaceable |
          SET old.active = false, old.updatedAt = datetime()
        )
      )
      FOREACH (_ IN CASE WHEN allowReplace THEN [1] ELSE [] END |
        MERGE (c)-[rel:CLASSIFIED_AS]->(o)
        ON CREATE SET rel.createdAt = datetime()
        SET rel.updatedAt = datetime(),
            rel.active = true,
            rel.source = $source,
            rel.confidence = $confidence,
            rel.reason = $reason,
            rel.decidedAt = datetime()
      )
    `;
    try {
      await this.neo4j.run(cypher, params);
    } catch (err) {
      this.logger.warn(
        `Auto-classify failed for ${params.conceptType}::${params.conceptName} -> ${params.oClassId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async classifyEventByOClass(params: {
    eventId: string;
    oClassId: string;
    confidence: number;
    source: string;
    reason: string | null;
  }): Promise<void> {
    const cypher = `
      MATCH (e:Event { eventId: $eventId })
      MATCH (o:OClass { id: $oClassId })
      WHERE o.facet = 'Activity'
      OPTIONAL MATCH (e)-[r:HAS_ACTIVITY]->(:OClass)
      WHERE coalesce(r.active, true) = true
      WITH e, o, collect(r) AS activeRels
      WITH e, o, activeRels,
           [r IN activeRels WHERE coalesce(r.source, '') IN ['llm', 'auto']
             AND coalesce(toFloat(r.confidence), -1) < $confidence] AS replaceable,
           [r IN activeRels WHERE NOT (coalesce(r.source, '') IN ['llm', 'auto']
             AND coalesce(toFloat(r.confidence), -1) < $confidence)] AS blocked
      WITH e, o, activeRels, replaceable, blocked,
           CASE
             WHEN size(activeRels) = 0 THEN true
             WHEN size(blocked) = 0 AND size(replaceable) > 0 THEN true
             ELSE false
           END AS allowReplace
      FOREACH (_ IN CASE WHEN allowReplace AND size(replaceable) > 0 THEN [1] ELSE [] END |
        FOREACH (old IN replaceable |
          SET old.active = false, old.updatedAt = datetime()
        )
      )
      FOREACH (_ IN CASE WHEN allowReplace THEN [1] ELSE [] END |
        MERGE (e)-[rel:HAS_ACTIVITY]->(o)
        ON CREATE SET rel.createdAt = datetime()
        SET rel.updatedAt = datetime(),
            rel.active = true,
            rel.source = $source,
            rel.confidence = $confidence,
            rel.reason = $reason,
            rel.decidedAt = datetime()
      )
    `;
    try {
      await this.neo4j.run(cypher, params);
    } catch (err) {
      this.logger.warn(
        `Auto-classify failed for event ${params.eventId} -> ${params.oClassId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
