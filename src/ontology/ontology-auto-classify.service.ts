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
  errors?: Array<Record<string, any>>;
};

type TaxonomyPayload = {
  oClassId: string;
  confidence?: number;
  source?: string;
  reason?: string | null;
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

  async classifyFromTaxonomy(params: {
    conceptName: string;
    conceptType: ConceptType;
    taxonomy?: TaxonomyPayload;
  }): Promise<void> {
    if (!this.isAutoClassifyEnabled()) return;
    const taxonomy = params.taxonomy;
    if (!taxonomy?.oClassId) return;

    const threshold = this.getAutoClassifyMinConfidence();
    const confidence = taxonomy.confidence ?? 0;
    if (confidence < threshold) return;

    await this.classifyConceptByOClass({
      conceptName: params.conceptName,
      conceptType: params.conceptType,
      oClassId: taxonomy.oClassId,
      confidence,
      source: taxonomy.source ?? 'llm',
      reason: taxonomy.reason ?? null,
    });
  }

  async autoClassifyUnclassifiedConcepts(params: {
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

    const candidates: ClassifyConceptInput[] = params.concepts.map((c) => ({
      conceptKey: `${c.conceptType}::${c.canonicalName}`,
      conceptType: c.conceptType,
      conceptName: c.canonicalName,
      sourceText: params.sourceText,
      normalizedTextEn: params.normalizedTextEn ?? null,
      surface: c.surface ?? null,
      span: c.span ?? null,
    }));

    const unclassified = await this.filterUnclassifiedConcepts(candidates);
    if (!unclassified.length) return;

    const snapshot = await this.adminService.getSnapshot();
    const payload: ClassifyRequestPayload = {
      concepts: unclassified,
      snapshot: {
        oClasses: snapshot.oClasses ?? [],
        subclassEdges: (snapshot.subclassEdges ?? []).map((edge: any) => ({
          childId: edge.child ?? edge.childId,
          parentId: edge.parent ?? edge.parentId,
        })),
        seedVersion: Array.isArray(snapshot.seedVersions)
          ? snapshot.seedVersions[0] ?? null
          : snapshot.seedVersions ?? null,
      },
      mode: 'existing_only',
    };

    const response = await this.requestMlClassify(payload);
    if (!response?.classifications?.length) return;

    const requestMap = new Map(
      unclassified.map((c) => [
        c.conceptKey,
        { conceptType: c.conceptType, conceptName: c.conceptName },
      ]),
    );
    const filtered = response.classifications.filter((item) => {
      if (!item?.conceptKey) return false;
      const expected = requestMap.get(item.conceptKey);
      if (!expected) return false;
      return (
        item.conceptType === expected.conceptType &&
        item.conceptName === expected.conceptName
      );
    });
    if (!filtered.length) return;

    const threshold = this.getAutoClassifyMinConfidence();
    for (const item of filtered) {
      const confidence = item.confidence ?? 0;
      if (!item.oClassId || confidence < threshold) continue;
      await this.classifyConceptByOClass({
        conceptName: item.conceptName,
        conceptType: item.conceptType,
        oClassId: item.oClassId,
        confidence,
        source: 'llm',
        reason: item.rationale ?? null,
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
  }): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $conceptName, type: $conceptType })
      MATCH (o:OClass { id: $oClassId })
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
}
