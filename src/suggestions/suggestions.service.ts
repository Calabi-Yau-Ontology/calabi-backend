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
  Relationship,
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

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * 실시간 자동완성: 입력 fragment로 SurfaceForm prefix를 조회한다.
   */
  async getRealtimeAutocomplete(
    userId: string,
    fragment: string,
    limit?: number,
  ): Promise<AutocompleteResponseDto> {
    const normalizedFragment = this.normalizeSurfaceInput(fragment);
    if (!normalizedFragment) {
      return { suggestions: [] };
    }

    const maxLimit = this.resolveAutocompleteLimit(limit);
    const cypher = `
      MATCH (u:User { id: $userId })-[usage:${RELATIONS.USED_SURFACE}]->(sf:SurfaceForm)
      MATCH (sf)-[:${RELATIONS.SURFACE_OF}]->(c:Concept)
      WHERE sf.normalized STARTS WITH $normalized
      RETURN sf AS sf, c AS concept, usage AS usageRel
      ORDER BY usage.lastUsedAt DESC, usage.updatedAt DESC, sf.updatedAt DESC
      LIMIT $limit
    `;
    const limitParam = neo4j.int(maxLimit);
    const res = await this.neo4j.run(cypher, {
      normalized: normalizedFragment,
      userId,
      limit: limitParam,
    });

    const suggestions = res.records.map((record: Neo4jRecord) =>
      this.mapAutocompleteRecord(
        record.get('sf') as Node,
        (record.get('concept') as Node | null) ?? null,
        (record.get('usageRel') as Relationship | null) ?? null,
      ),
    );

    return {
      suggestions: this.excludeMatchingSurface(suggestions, normalizedFragment),
    };
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

    const rows = await this.fetchConsistencyRows(userId, canonicalMentions);
    const results: ConsistencyRecommendationDto[] = rows
      .map((row) => this.mapConsistencyRow(row))
      .filter((row): row is ConsistencyRecommendationDto => row !== null);

    return {
      cacheToken,
      results,
      errors: ner.errors,
    };
  }
  
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

  // ---------------------------------------------------------------------------
  // Canonical mention & Neo4j query helpers
  // ---------------------------------------------------------------------------

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
    userId: string,
    items: CanonicalMention[],
  ): Promise<ConsistencyRecommendationRow[]> {
    if (!items.length) return [];

    const surfaceRel = RELATIONS.SURFACE_OF;
    const usageRel = RELATIONS.USED_SURFACE;
    const cypher = `
      MATCH (u:User { id: $userId })
      UNWIND $items AS item
      MATCH (c:Concept { name: item.canonicalName })
      CALL {
        WITH c, u
        MATCH (u)-[freqRel:${usageRel}]->(freq:SurfaceForm)-[:${surfaceRel}]->(c)
        RETURN freq, freqRel
        ORDER BY freqRel.usageCount DESC, freqRel.lastUsedAt DESC, freq.updatedAt DESC
        LIMIT 1
      }
      CALL {
        WITH c, u
        MATCH (u)-[recentRel:${usageRel}]->(recent:SurfaceForm)-[:${surfaceRel}]->(c)
        RETURN recent, recentRel
        ORDER BY recentRel.lastUsedAt DESC, recentRel.updatedAt DESC, recent.updatedAt DESC
        LIMIT 1
      }
      RETURN {
        canonicalName: item.canonicalName,
        conceptType: c.type,
        inputSurface: item.surface,
        mostFrequent: { node: freq, rel: freqRel },
        mostRecent: { node: recent, rel: recentRel }
      } AS row
    `;

    const res = await this.neo4j.run(cypher, { items, userId });
    return res.records.map(
      (record: Neo4jRecord) =>
        record.get('row') as ConsistencyRecommendationRow,
    );
  }

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

  private mapConsistencyRow(
    row: ConsistencyRecommendationRow,
  ): ConsistencyRecommendationDto | null {
    const normalizedInput = normalizeSurfaceForm(row.inputSurface ?? '');

    const mostFrequent = this.toSurfaceRecommendation(
      row.mostFrequent,
      'most_frequent',
      normalizedInput,
    );
    const mostRecent = this.toSurfaceRecommendation(
      row.mostRecent,
      'most_recent',
      normalizedInput,
    );

    if (!mostFrequent && !mostRecent) {
      return null;
    }

    return {
      canonicalName: row.canonicalName,
      conceptType: row.conceptType ?? undefined,
      inputSurface: row.inputSurface ?? null,
      mostFrequent,
      mostRecent,
    };
  }

  private mapAutocompleteRecord(
    surfaceNode: Node,
    conceptNode: Node | null,
    usageRel: Relationship | null,
  ): AutocompleteSuggestionDto {
    const surface = this.extractSurfaceForm(surfaceNode);
    const concept = this.extractConcept(conceptNode);
    const usage = this.extractUsedSurface(usageRel);

    return {
      surface: surface.value ?? '',
      conceptName: concept.name ?? surface.conceptName,
      conceptType: concept.type ?? surface.conceptType,
      lastUsedAt: usage.lastUsedAt ?? surface.lastUsedAt,
      usageCount: usage.usageCount ?? surface.usageCount,
    };
  }

  private toSurfaceRecommendation(
    entry: SurfaceRecommendationRowEntry | null | undefined,
    reason: RecommendationReason,
    normalizedInput?: string,
  ): SurfaceRecommendationDto | null {
    const surface = this.extractSurfaceForm(entry?.node ?? null);
    const usage = this.extractUsedSurface(entry?.rel ?? null);
    if (!surface.value || !usage.exists) return null;

    const normalizedSurface = this.normalizeSurfaceInput(surface.value);
    if (normalizedInput && normalizedSurface === normalizedInput) {
      return null;
    }

    return {
      reason,
      surface: surface.value,
      usageCount: usage.usageCount ?? surface.usageCount,
      lastUsedAt: usage.lastUsedAt ?? surface.lastUsedAt,
    };
  }

  private extractSurfaceForm(node: Node | null): SurfaceFormData {
    if (!node) return SurfaceFormDefaults;
    const props = node.properties ?? {};
    return {
      value: this.asString(props['value']),
      normalized: this.asString(props['normalized']),
      conceptName: this.asString(props['conceptName']),
      conceptType: this.asConceptType(props['conceptType']),
      usageCount: this.toNumber(props['usageCount']),
      lastUsedAt: this.toIsoString(props['lastUsedAt']),
    };
  }

  private extractConcept(node: Node | null): ConceptData {
    if (!node) return ConceptDefaults;
    const props = node.properties ?? {};
    return {
      name: this.asString(props['name']),
      type: this.asConceptType(props['type']),
    };
  }

  private extractUsedSurface(rel: Relationship | null): UsedSurfaceData {
    if (!rel) return UsedSurfaceDefaults;
    const props = rel.properties ?? {};
    return {
      exists: true,
      usageCount: this.toNumber(props['usageCount']),
      lastUsedAt: this.toIsoString(props['lastUsedAt']),
    };
  }

  private excludeMatchingSurface(
    suggestions: AutocompleteSuggestionDto[],
    normalizedInput: string,
  ): AutocompleteSuggestionDto[] {
    if (!normalizedInput) return suggestions;
    return suggestions.filter(
      (item) => this.normalizeSurfaceInput(item.surface) !== normalizedInput,
    );
  }

  private normalizeSurfaceInput(value: string | null | undefined): string {
    return normalizeSurfaceForm(value?.trim() ?? '');
  }

  private resolveAutocompleteLimit(limit?: number): number {
    const numeric =
      typeof limit === 'number'
        ? limit
        : Number.parseInt(String(limit ?? ''), 10);
    const candidate = Number.isFinite(numeric)
      ? numeric
      : AUTOCOMPLETE_DEFAULT_LIMIT;
    return Math.max(1, Math.min(Math.floor(candidate), AUTOCOMPLETE_MAX_LIMIT));
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

type SurfaceRecommendationRowEntry = {
  node?: Node | null;
  rel?: Relationship | null;
} | null;

type ConsistencyRecommendationRow = {
  canonicalName: string;
  conceptType?: ConceptType;
  inputSurface?: string | null;
  mostFrequent?: SurfaceRecommendationRowEntry;
  mostRecent?: SurfaceRecommendationRowEntry;
};

type CachedNerEntry = {
  userId: string;
  text: string;
  ner: NerResponseDto;
  createdAt: number;
};

type SurfaceFormData = {
  value?: string;
  normalized?: string;
  conceptName?: string;
  conceptType?: ConceptType;
  usageCount?: number;
  lastUsedAt?: string | null;
};

type ConceptData = {
  name?: string;
  type?: ConceptType;
};

type UsedSurfaceData = {
  exists: boolean;
  usageCount?: number;
  lastUsedAt?: string | null;
};

const SurfaceFormDefaults: SurfaceFormData = {};
const ConceptDefaults: ConceptData = {};
const UsedSurfaceDefaults: UsedSurfaceData = { exists: false };
