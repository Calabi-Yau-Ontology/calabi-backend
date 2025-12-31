import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError, isAxiosError } from 'axios';
import { randomUUID } from 'crypto';
import neo4j from 'neo4j-driver';
import type {
  DateTime as Neo4jDateTime,
  Node,
  Record as Neo4jRecord,
} from 'neo4j-driver';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { normalizeSurfaceForm } from 'src/common/utils/text-normalize';
import { RELATIONS } from 'src/ontology/constants/relations';
import {
  ConceptType,
  isAllowedNerLabel,
} from 'src/ontology/constants/concept.types';
import type { NerResponseDto } from './dto/ner-response.dto';
import type { RunNerDto } from './dto/run-ner.dto';
import type {
  AutocompleteResponseDto,
  AutocompleteSuggestionDto,
} from './dto/autocomplete-response.dto';
import type {
  ConsistencyCheckResponseDto,
  ConsistencyRecommendationDto,
  SurfaceRecommendationDto,
  RecommendationReason,
} from './dto/consistency-response.dto';

const AUTOCOMPLETE_DEFAULT_LIMIT = 5;
const AUTOCOMPLETE_MAX_LIMIT = 10;
const NER_CACHE_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);
  private readonly baseUrl: string;
  private readonly nerCache = new Map<string, CachedNerEntry>();

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly neo4j: Neo4jService,
  ) {
    const mlConfig = this.configService.get<{ baseUrl: string }>('ml');
    this.baseUrl = mlConfig?.baseUrl ?? '';
  }

  /**
   * 실시간 자동완성: 입력 fragment로 SurfaceForm prefix를 조회한다.
   */
  async getRealtimeAutocomplete(
    fragment: string,
    limit?: number,
  ): Promise<AutocompleteResponseDto> {
    const normalized = normalizeSurfaceForm(fragment?.trim() ?? '');
    if (!normalized) {
      return { suggestions: [] };
    }

    const numericLimit =
      typeof limit === 'number'
        ? limit
        : Number.parseInt(String(limit ?? ''), 10);
    const limitCandidate = Number.isFinite(numericLimit)
      ? numericLimit
      : AUTOCOMPLETE_DEFAULT_LIMIT;
    const maxLimit = Math.max(
      1,
      Math.min(Math.floor(limitCandidate), AUTOCOMPLETE_MAX_LIMIT),
    );
    const cypher = `
      MATCH (sf:SurfaceForm)-[:${RELATIONS.SURFACE_OF}]->(c:Concept)
      WHERE sf.normalized STARTS WITH $normalized
      RETURN sf AS sf, c AS concept
      ORDER BY sf.lastUsedAt DESC, sf.updatedAt DESC
      LIMIT $limit
    `;
    console.log('maxLimit:', maxLimit);
    const limitParam = neo4j.int(maxLimit);
    console.log('limitParam:', limitParam);
    const res = await this.neo4j.run(cypher, { normalized, limit: limitParam });

    const suggestions: AutocompleteSuggestionDto[] = res.records.map(
      (record: Neo4jRecord) => {
        const surfaceNode = record.get('sf') as Node;
        const conceptNode = (record.get('concept') as Node | null) ?? null;
        return this.mapAutocompleteRecord(surfaceNode, conceptNode);
      },
    );

    return { suggestions };
  }

  /**
   * NER 기반 일관성 검사: NER 결과 캐싱 후, 기존 SurfaceForm 통계를 조회해 추천.
   */
  async runConsistencyCheck(
    userId: string,
    text: string,
  ): Promise<ConsistencyCheckResponseDto> {
    const cleanedText = text?.trim() ?? '';
    const ner = await this.runNer({ text: cleanedText });
    const cacheToken = this.cacheNerResult(userId, cleanedText, ner);

    const canonicalMentions = this.extractCanonicalMentions(ner);
    if (!canonicalMentions.length) {
      return {
        cacheToken,
        results: [],
        errors: ner.errors,
      };
    }

    const rows = await this.fetchConsistencyRows(canonicalMentions);
    const results: ConsistencyRecommendationDto[] = rows.map((row) =>
      this.mapConsistencyRow(row),
    );

    return {
      cacheToken,
      results,
      errors: ner.errors,
    };
  }

  // async runNer(text: RunNerDto): Promise<NerResponseDto> {
  //   const url = `${this.baseUrl}/nlp/ner`;

  //   try {
  //     const response$ = this.httpService.post(url, text);
  //     const { data } = await firstValueFrom(response$);
  //     return data;
  //   } catch (error) {
  //     const err = error as AxiosError;
  //     this.logger.error(`NER request failed: ${err.message}`, err.stack);
  //     return { entities: [] };
  //   }
  // }
  async runNer(text: RunNerDto): Promise<NerResponseDto> {
    const url = `${this.baseUrl}/nlp/ner`;

    try {
      const response$ = this.httpService.post<NerResponseDto>(url, text);
      const { data } = await firstValueFrom(response$);
      return data ?? { mentions: [] };
    } catch (error: unknown) {
      const err = this.normalizeAxiosError(error);
      this.logger.error(`NER request failed: ${err.message}`, err.stack);
      return {
        mentions: [],
        errors: [{ stage: 'backend_http', message: err.message }],
      };
    }
  }

  /**
   * NER 결과 캐시에서 토큰을 조회 (이후 Event 저장 시 활용 예정)
   */
  getCachedNer(token: string, userId: string): NerResponseDto | null {
    this.pruneNerCache();
    const entry = this.nerCache.get(token);
    if (!entry || entry.userId !== userId) {
      return null;
    }
    return entry.ner;
  }

  consumeCachedNer(token: string, userId: string): NerResponseDto | null {
    const entry = this.getCachedNer(token, userId);
    if (!entry) return null;
    this.nerCache.delete(token);
    return entry;
  }

  private extractCanonicalMentions(ner: NerResponseDto): CanonicalMention[] {
    const mentions = ner?.mentions ?? [];
    const map = new Map<string, CanonicalMention>();

    for (const mention of mentions) {
      const label = mention?.ner?.label;
      if (!isAllowedNerLabel(label)) continue;

      const canonicalName = mention?.canonical?.en?.trim();
      if (!canonicalName || map.has(canonicalName)) continue;

      map.set(canonicalName, {
        canonicalName,
        surface: mention?.surface?.trim() ?? null,
      });
    }

    return Array.from(map.values());
  }

  private async fetchConsistencyRows(
    items: CanonicalMention[],
  ): Promise<ConsistencyRecommendationRow[]> {
    if (!items.length) return [];

    const relation = RELATIONS.SURFACE_OF;
    const cypher = `
      UNWIND $items AS item
      MATCH (c:Concept { name: item.canonicalName })
      CALL {
        WITH c
        MATCH (c)<-[:${relation}]-(freq:SurfaceForm)
        RETURN freq
        ORDER BY freq.usageCount DESC, freq.lastUsedAt DESC, freq.updatedAt DESC
        LIMIT 1
      }
      CALL {
        WITH c
        MATCH (c)<-[:${relation}]-(recent:SurfaceForm)
        RETURN recent
        ORDER BY recent.lastUsedAt DESC, recent.updatedAt DESC
        LIMIT 1
      }
      RETURN {
        canonicalName: item.canonicalName,
        conceptType: c.type,
        inputSurface: item.surface,
        mostFrequent: freq,
        mostRecent: recent
      } AS row
    `;

    const res = await this.neo4j.run(cypher, { items });
    return res.records.map(
      (record: Neo4jRecord) =>
        record.get('row') as ConsistencyRecommendationRow,
    );
  }

  private mapConsistencyRow(
    row: ConsistencyRecommendationRow,
  ): ConsistencyRecommendationDto {
    return {
      canonicalName: row.canonicalName,
      conceptType: row.conceptType ?? undefined,
      inputSurface: row.inputSurface ?? null,
      mostFrequent: this.toSurfaceRecommendation(
        row.mostFrequent,
        'most_frequent',
      ),
      mostRecent: this.toSurfaceRecommendation(row.mostRecent, 'most_recent'),
    };
  }

  private mapAutocompleteRecord(
    surfaceNode: Node,
    conceptNode: Node | null,
  ): AutocompleteSuggestionDto {
    const surfaceProps = this.getNodeProperties(surfaceNode);
    const conceptProps = this.getNodeProperties(conceptNode);

    const surfaceValue = this.asString(surfaceProps['value']) ?? '';
    const conceptName =
      this.asString(conceptProps['name']) ??
      this.asString(surfaceProps['conceptName']);
    const conceptType =
      this.asConceptType(conceptProps['type']) ??
      this.asConceptType(surfaceProps['conceptType']);

    return {
      surface: surfaceValue,
      conceptName,
      conceptType,
      lastUsedAt: this.toIsoString(surfaceProps['lastUsedAt']),
      usageCount: this.toNumber(surfaceProps['usageCount']),
    };
  }

  private toSurfaceRecommendation(
    node: Node | null | undefined,
    reason: RecommendationReason,
  ): SurfaceRecommendationDto | null {
    if (!node) return null;
    const props = this.getNodeProperties(node);
    return {
      reason,
      surface: this.asString(props['value']) ?? '',
      usageCount: this.toNumber(props['usageCount']),
      lastUsedAt: this.toIsoString(props['lastUsedAt']),
    };
  }

  private getNodeProperties(
    node: Node | null | undefined,
  ): Record<string, unknown> {
    if (!node) return {};
    const props = node.properties;
    if (props && typeof props === 'object') {
      return props as Record<string, unknown>;
    }
    return {};
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private asConceptType(value: unknown): ConceptType | undefined {
    return typeof value === 'string' ? (value as ConceptType) : undefined;
  }

  private toNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number') return value;
    if (neo4j.isInt(value)) {
      return value.toNumber();
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private toIsoString(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (this.isNeo4jDateTime(value)) {
      return this.neo4jDateTimeToIso(value);
    }
    return null;
  }

  private isNeo4jDateTime(value: unknown): value is Neo4jDateTime {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return (
      'year' in candidate &&
      'month' in candidate &&
      'day' in candidate &&
      'hour' in candidate &&
      'minute' in candidate &&
      'second' in candidate &&
      'nanosecond' in candidate
    );
  }

  private neo4jDateTimeToIso(value: Neo4jDateTime): string {
    const year = this.toNumber(value.year) ?? 0;
    const month = this.toNumber(value.month) ?? 1;
    const day = this.toNumber(value.day) ?? 1;
    const hour = this.toNumber(value.hour) ?? 0;
    const minute = this.toNumber(value.minute) ?? 0;
    const second = this.toNumber(value.second) ?? 0;
    const nanosecond = this.toNumber(value.nanosecond) ?? 0;
    const millisecond = Math.floor(nanosecond / 1_000_000);

    const jsDate = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
    );
    return jsDate.toISOString();
  }

  private cacheNerResult(
    userId: string,
    text: string,
    ner: NerResponseDto,
  ): string {
    this.pruneNerCache();
    const token = randomUUID();
    this.nerCache.set(token, {
      userId,
      text,
      ner,
      createdAt: Date.now(),
    });
    return token;
  }

  private pruneNerCache(): void {
    const now = Date.now();
    for (const [token, entry] of this.nerCache.entries()) {
      if (now - entry.createdAt > NER_CACHE_TTL_MS) {
        this.nerCache.delete(token);
      }
    }
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

type CanonicalMention = {
  canonicalName: string;
  surface?: string | null;
};

type ConsistencyRecommendationRow = {
  canonicalName: string;
  conceptType?: ConceptType;
  inputSurface?: string | null;
  mostFrequent?: Node | null;
  mostRecent?: Node | null;
};

type CachedNerEntry = {
  userId: string;
  text: string;
  ner: NerResponseDto;
  createdAt: number;
};
