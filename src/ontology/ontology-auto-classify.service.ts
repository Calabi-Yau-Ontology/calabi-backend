import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { ConceptType } from './constants/concept.types';
import { OntologyAdminService } from './ontology-admin.service';
import { ClassificationRepository } from './classification.repository';
import { buildSnapshotPayload } from './snapshot.utils';

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
    private readonly classificationRepo: ClassificationRepository,
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

    const snapshot = await this.adminService.getSnapshot();
    const entitySnapshot = buildSnapshotPayload(snapshot, ['Entity']);
    const activitySnapshot = buildSnapshotPayload(snapshot, ['Activity']);

    const unclassified = inputs.length
      ? await this.filterUnclassifiedConcepts(inputs)
      : [];
    const usableUnclassified =
      entitySnapshot.oClasses.length > 0 ? unclassified : [];

    let appliedEvent = false;

    if (usableUnclassified.length) {
      const payload: ClassifyRequestPayload = {
        concepts: usableUnclassified,
        snapshot: entitySnapshot,
        mode: 'existing_only',
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        eventNormalizedTextEn: params.normalizedTextEn ?? null,
      };

      const response = await this.requestMlClassify(payload);
      if (response) {
        const classifications = response.classifications ?? [];
        const requestMap = new Map(
          usableUnclassified.map((c) => [
            c.conceptKey,
            { conceptType: c.conceptType, conceptName: c.conceptName },
          ]),
        );
        appliedEvent = await this.applyEventActivities(
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

        const threshold = this.getAutoClassifyMinConfidence();
        for (const item of filtered) {
          const confidence = item.confidence ?? 0;
          if (!item.oClassId || confidence < threshold) continue;
          await this.classificationRepo.applyAutoConceptClassification({
            conceptName: item.conceptName,
            conceptType: item.conceptType,
            oClassId: item.oClassId,
            confidence,
            source: 'llm',
            reason: item.rationale ?? null,
            expectedFacet: 'Entity',
          });
        }
      }
    }

    if (!appliedEvent) {
      await this.requestEventActivitiesOnly({
        eventId: params.eventId,
        eventTitle: params.eventTitle,
        normalizedTextEn: params.normalizedTextEn ?? null,
        snapshot: activitySnapshot,
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
      const countValue = record.get('activeCount');
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
    const filteredSnapshot = buildSnapshotPayload(snapshot, ['Activity']);
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
      await this.classificationRepo.applyAutoEventClassification({
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
      const status = err.response?.status;
      const errorData = err.response?.data as any;
      if (status && errorData) {
        this.logger.warn(
          `ML classify request failed (status ${status}): ${JSON.stringify(errorData)}`,
        );
      }
      this.logger.warn(`ML classify request failed: ${err.message}`, err.stack);
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

}
