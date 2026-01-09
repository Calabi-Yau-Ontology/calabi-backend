import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError, isAxiosError } from 'axios';
import neo4j from 'neo4j-driver';
import type { Node, Record as Neo4jRecord, Relationship } from 'neo4j-driver';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { RELATIONS } from 'src/ontology/constants/relations';
import { ConceptType, isAllowedNERLabel } from 'src/ontology/constants/concept.types';
import { NerCacheService } from './cache/ner-cache.service';
import type { NERResponseDto } from './dto/ner-response.dto';
import type { RunNERDto } from './dto/run-ner.dto';
import { ConsistencyCheckRequestDto } from './dto/consistency-request.dto';
import {
  ConsistencyDecisionAction,
  ConsistencyDecisionPairDto,
  ConsistencyDecisionRequestDto,
} from './dto/consistency-decision.dto';
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
import { Event } from 'src/events/entities/event.entity';
import {
  EVENT_NER_CACHE_POLL_INTERVAL_MS,
  EVENT_NER_CACHE_TIMEOUT_MS,
  EVENT_NER_CACHE_TTL_SECONDS,
  buildEventNerCacheKey,
  normalizeEventTitle,
} from 'src/events/utils/event-ner-cache.util';
import { ERROR_MESSAGES } from 'src/common/constants/error-messages';
import { normalizeSurfaceForm } from 'src/common/utils/text-normalize';

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
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
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
   * NER 기반 일관성 검사: 이벤트 캐시 또는 즉석 텍스트 기반으로 추천을 반환한다.
   */
  async runConsistencyCheck(
    userId: string,
    dto: ConsistencyCheckRequestDto,
  ): Promise<ConsistencyCheckResponseDto> {
    if (dto.eventId) {
      return this.runEventConsistencyCheck(userId, dto.eventId);
    }
    const text = dto.text?.trim() ?? '';
    return this.runAdhocConsistencyCheck(userId, text);
  }

  private async runAdhocConsistencyCheck(
    userId: string,
    text: string,
  ): Promise<ConsistencyCheckResponseDto> {
    const cleanedText = text?.trim() ?? '';
    const ner = await this.runNER({ text: cleanedText });
    this.raiseIfNerFailed(ner);
    await this.nerCacheService.store(
      userId,
      cleanedText,
      ner,
    );
    return this.buildConsistencyResponse(userId, ner);
  }

  private async runEventConsistencyCheck(
    userId: string,
    eventId: string,
  ): Promise<ConsistencyCheckResponseDto> {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId, user: { id: userId } },
    });
    if (!event) {
      throw new NotFoundException(ERROR_MESSAGES.EVENT.NOT_FOUND);
    }

    const normalizedTitle = normalizeEventTitle(event.title);
    if (!normalizedTitle) {
      throw new BadRequestException('Event title is empty');
    }

    const cacheKey = await this.ensureEventCacheKey(event, normalizedTitle);

    const ner = await this.waitForEventNerCache(cacheKey, userId);
    if (!ner) {
      this.logger.warn(
        `Consistency check timeout for event ${eventId} (user: ${userId})`,
      );
      throw new ServiceUnavailableException('NER processing timeout');
    }
    this.raiseIfNerFailed(ner);

    return this.buildConsistencyResponse(userId, ner);
  }

  private async waitForEventNerCache(
    cacheKey: string,
    userId: string,
  ): Promise<NERResponseDto | null> {
    const deadline = Date.now() + EVENT_NER_CACHE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const cached = await this.nerCacheService.resolve(cacheKey, userId);
      if (cached) {
        await this.nerCacheService.refreshTTL(
          cacheKey,
          EVENT_NER_CACHE_TTL_SECONDS,
        );
        return cached;
      }
      await this.delay(EVENT_NER_CACHE_POLL_INTERVAL_MS);
    }
    return null;
  }

  private async ensureEventCacheKey(
    event: Event,
    normalizedTitle: string,
  ): Promise<string> {
    const expectedKey = buildEventNerCacheKey(event.id, normalizedTitle);
    const existingKey = event.nerCacheKey?.trim() ?? null;

    if (existingKey && existingKey !== expectedKey) {
      await this.nerCacheService.remove(existingKey);
    }

    if (!existingKey || existingKey !== expectedKey) {
      await this.eventsRepo.update(event.id, {
        nerCacheKey: expectedKey,
        nerCacheStatus: 'pending',
      });
      event.nerCacheKey = expectedKey;
    }

    return expectedKey;
  }

  private async buildConsistencyResponse(
    userId: string,
    ner: NERResponseDto,
  ): Promise<ConsistencyCheckResponseDto> {
    const canonicalMentions = this.extractCanonicalMentions(ner);

    if (!canonicalMentions.length) {
      return {
        results: [],
      };
    }

    try {
      const rows = await this.fetchConsistencyRows(userId, canonicalMentions);
      const results: ConsistencyRecommendationDto[] = rows
        .map((row) => this.mapConsistencyRow(row))
        .filter((row): row is ConsistencyRecommendationDto => row !== null);
      return {
        results,
      };
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);
      this.logger.error(
        `Consistency query failed for user ${userId}: ${message}`,
        this.extractErrorStack(error),
      );
      throw new ServiceUnavailableException(message);
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async confirmConsistencyDecision(
    userId: string,
    dto: ConsistencyDecisionRequestDto,
  ): Promise<void> {
    const event = await this.eventsRepo.findOne({
      where: { id: dto.eventId, user: { id: userId } },
    });
    if (!event) {
      throw new NotFoundException(ERROR_MESSAGES.EVENT.NOT_FOUND);
    }

    const existingKey = event.nerCacheKey?.trim() ?? null;

    if (dto.action === ConsistencyDecisionAction.Applied) {
      const beforeTitle = dto.beforeTitle?.trim() ?? '';
      const afterTitle = dto.afterTitle?.trim() ?? '';
      const pairs = dto.pairs ?? [];
      if (!beforeTitle) {
        throw new BadRequestException('Before title is required');
      }
      if (!afterTitle) {
        throw new BadRequestException('After title is required');
      }
      if (!pairs.length) {
        throw new BadRequestException('Pairs are required');
      }
      if (
        normalizeEventTitle(beforeTitle) !==
        normalizeEventTitle(event.title)
      ) {
        throw new ConflictException('Event title has changed');
      }

      const appliedMentions = this.extractAppliedPairs(pairs);
      if (appliedMentions.length) {
        await this.recordAppliedSurfaceUsage(userId, event.id, appliedMentions);
      }

      event.title = afterTitle;
      if (existingKey) {
        await this.nerCacheService.remove(existingKey);
      }
      event.nerCacheKey = null;
      event.nerCacheStatus = 'consumed';
      const savedEvent = await this.eventsRepo.save(event);
      await this.updateOntologyEventTitle(savedEvent);
      return;
    }

    if (existingKey) {
      await this.nerCacheService.remove(existingKey);
    }
    event.nerCacheKey = null;
    event.nerCacheStatus = 'consumed';
    await this.eventsRepo.save(event);
  }

  private extractAppliedPairs(
    pairs: ConsistencyDecisionPairDto[],
  ): Array<{
    canonicalName: string;
    conceptType: ConceptType;
    surface: string;
    normalized: string;
  }> {
    const appliedMap = new Map<
      string,
      {
        canonicalName: string;
        conceptType: ConceptType;
        surface: string;
        normalized: string;
      }
    >();

    for (const pair of pairs) {
      const canonicalName = pair?.canonicalName?.trim();
      const conceptType = pair?.conceptType;
      const surface = pair?.appliedSurface?.trim();
      if (!canonicalName || !conceptType || !surface) continue;

      const normalized = normalizeSurfaceForm(surface);
      if (!normalized) continue;

      const key = `${conceptType}::${canonicalName}::${normalized}`;
      if (appliedMap.has(key)) continue;
      appliedMap.set(key, {
        canonicalName,
        conceptType,
        surface,
        normalized,
      });
    }

    return Array.from(appliedMap.values());
  }

  private async recordAppliedSurfaceUsage(
    userId: string,
    eventId: string,
    appliedMentions: Array<{
      canonicalName: string;
      conceptType: ConceptType;
      surface: string;
      normalized: string;
    }>,
  ): Promise<void> {
    const now = new Date().toISOString();
    for (const mention of appliedMentions) {
      const key = `${mention.conceptType}::${mention.canonicalName}::${mention.normalized}`;
      const params = {
        conceptName: mention.canonicalName,
        conceptType: mention.conceptType,
        surface: mention.surface,
        normalized: mention.normalized,
        key,
        now,
        userId,
        eventId,
      };
      await this.upsertSurfaceFormNode(params);
      await this.linkUserToSurfaceForm(params);
    }
  }

  private async upsertSurfaceFormNode(params: {
    conceptName: string;
    conceptType: ConceptType;
    surface: string;
    normalized: string;
    key: string;
    now: string;
    userId: string;
    eventId: string;
  }): Promise<void> {
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

  private async linkUserToSurfaceForm(params: {
    conceptName: string;
    conceptType: ConceptType;
    surface: string;
    normalized: string;
    key: string;
    now: string;
    userId: string;
    eventId: string;
  }): Promise<void> {
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

  private async updateOntologyEventTitle(event: Event): Promise<void> {
    const updatedAt = event.updatedAt?.toISOString() ?? new Date().toISOString();
    const cypher = `
      MATCH (e:Event { eventId: $eventId })
      SET e.title = $title,
          e.updatedAt = datetime($updatedAt)
      RETURN e
    `;
    try {
      const result = await this.neo4j.run(cypher, {
        eventId: event.id,
        title: event.title,
        updatedAt,
      });
      if (!result.records.length) {
        this.logger.warn(
          `Ontology event node not found for title update: ${event.id}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to update ontology event title for ${event.id}: ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }


  private raiseIfNerFailed(ner: NERResponseDto): void {
    if (!ner?.errors?.length) {
      return;
    }
    const message = ner.errors
      .map((error) => error?.message)
      .filter((value): value is string => Boolean(value))
      .join(', ');
    throw new ServiceUnavailableException(message || 'NER failed');
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
