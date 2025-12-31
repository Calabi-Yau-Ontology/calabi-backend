import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError, isAxiosError } from 'axios';
import neo4j from 'neo4j-driver';
import type { Node, Record as Neo4jRecord, Relationship } from 'neo4j-driver';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { RELATIONS } from 'src/ontology/constants/relations';
import { isAllowedNERLabel } from 'src/ontology/constants/concept.types';
import { NerCacheService } from './cache/ner-cache.service';
import type { NERResponseDto } from './dto/ner-response.dto';
import type { RunNERDto } from './dto/run-ner.dto';
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
import {
  extractConcept,
  extractSurfaceForm,
  extractUsedSurface,
  excludeMatchingSurface,
  normalizeSurfaceInput,
  toSurfaceRecommendationDto,
} from './helpers/surface-form.helper';
import type {
  CanonicalMention,
  ConsistencyRecommendationRow,
  SurfaceRecommendationRowEntry,
} from './types/graph.types';

const AUTOCOMPLETE_DEFAULT_LIMIT = 5;
const AUTOCOMPLETE_MAX_LIMIT = 10;

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly neo4j: Neo4jService,
    private readonly nerCacheService: NerCacheService,
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
    const normalizedFragment = normalizeSurfaceInput(fragment);
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

    try {
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
        suggestions: excludeMatchingSurface(suggestions, normalizedFragment),
      };
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);
      this.logger.error(
        `Autocomplete query failed for user ${userId}: ${message}`,
        this.extractErrorStack(error),
      );
      return { suggestions: [] };
    }
  }

  /**
   * NER 기반 일관성 검사: NER 결과 캐싱 후, 기존 SurfaceForm 통계를 조회해 추천.
   */
  async runConsistencyCheck(
    userId: string,
    text: string,
  ): Promise<ConsistencyCheckResponseDto> {
    const cleanedText = text?.trim() ?? '';
    const ner = await this.runNER({ text: cleanedText });
    const cacheToken = await this.nerCacheService.store(
      userId,
      cleanedText,
      ner,
    );

    const canonicalMentions = this.extractCanonicalMentions(ner);
    if (!canonicalMentions.length) {
      return {
        cacheToken,
        results: [],
        errors: ner.errors,
      };
    }

    let rows: ConsistencyRecommendationRow[] = [];
    try {
      rows = await this.fetchConsistencyRows(userId, canonicalMentions);
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);
      this.logger.error(
        `Consistency query failed for user ${userId}: ${message}`,
        this.extractErrorStack(error),
      );
      const errors = [...(ner.errors ?? []), { stage: 'neo4j', message }];
      return {
        cacheToken,
        results: [],
        errors,
      };
    }
    const results: ConsistencyRecommendationDto[] = rows
      .map((row) => this.mapConsistencyRow(row))
      .filter((row): row is ConsistencyRecommendationDto => row !== null);

    return {
      cacheToken,
      results,
      errors: ner.errors,
    };
  }

  async runNER(text: RunNERDto): Promise<NERResponseDto> {
    const url = `${this.baseUrl}/nlp/ner`;

    try {
      const response$ = this.httpService.post<NERResponseDto>(url, text);
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
  async getCachedNER(
    token: string,
    userId: string,
  ): Promise<NERResponseDto | null> {
    return this.nerCacheService.resolve(token, userId);
  }

  async consumeCachedNER(
    token: string,
    userId: string,
  ): Promise<NERResponseDto | null> {
    return this.nerCacheService.consume(token, userId);
  }

  // ---------------------------------------------------------------------------
  // Canonical mention & Neo4j query helpers
  // ---------------------------------------------------------------------------

  private extractCanonicalMentions(ner: NERResponseDto): CanonicalMention[] {
    const mentions = ner?.mentions ?? [];
    const map = new Map<string, CanonicalMention>();

    for (const mention of mentions) {
      const label = mention?.ner?.label;
      if (!isAllowedNERLabel(label)) continue;

      const canonicalName = mention?.canonical?.en?.trim();
      if (!canonicalName || map.has(canonicalName)) continue;

      map.set(canonicalName, {
        canonicalName,
        surface: mention?.surface?.trim() ?? null,
        span: mention?.span ?? null,
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
        inputSpan: item.span,
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
    const normalizedInput = normalizeSurfaceInput(row.inputSurface);

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
      span: row.inputSpan ?? null,
      mostFrequent,
      mostRecent,
    };
  }

  private mapAutocompleteRecord(
    surfaceNode: Node,
    conceptNode: Node | null,
    usageRel: Relationship | null,
  ): AutocompleteSuggestionDto {
    const surface = extractSurfaceForm(surfaceNode);
    const concept = extractConcept(conceptNode);
    const usage = extractUsedSurface(usageRel);

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
    const surface = extractSurfaceForm(entry?.node ?? null);
    const usage = extractUsedSurface(entry?.rel ?? null);
    return toSurfaceRecommendationDto(
      { surface, usage },
      reason,
      normalizedInput,
    );
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

  private normalizeAxiosError(error: unknown): AxiosError {
    if (isAxiosError(error)) {
      return error;
    }
    const message =
      error instanceof Error ? error.message : 'Unknown axios error';
    return new AxiosError(message);
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private extractErrorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }
}
