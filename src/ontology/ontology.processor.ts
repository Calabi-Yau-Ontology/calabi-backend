import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Event,
  type EventNerCacheStatus,
} from 'src/events/entities/event.entity';
import { SuggestionsService } from 'src/suggestions/suggestions.service';
import { NerCacheService } from 'src/suggestions/cache/ner-cache.service';
import type { NERResponseDto } from 'src/suggestions/dto/ner-response.dto';
import { UsersService } from 'src/users/users.service';
import type { User } from 'src/users/entities/user.entity';
import { OntologyService } from './ontology.service';
import {
  ONTOLOGY_QUEUE_NAME,
  OntologyQueueJob,
  PROCESS_EVENT_ONTOLOGY_JOB,
} from './types/ontology-queue-job';
import {
  EVENT_NER_CACHE_TTL_SECONDS,
  buildEventNerCacheKey,
  normalizeEventTitle,
} from 'src/events/utils/event-ner-cache.util';

@Processor(ONTOLOGY_QUEUE_NAME)
export class OntologyProcessor {
  private readonly logger = new Logger(OntologyProcessor.name);

  constructor(
    private readonly ontologyService: OntologyService,
    private readonly suggestionsService: SuggestionsService,
    private readonly usersService: UsersService,
    private readonly nerCacheService: NerCacheService,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
  ) {}

  @Process({ name: PROCESS_EVENT_ONTOLOGY_JOB, concurrency: 1 })
  async handle(job: Job<OntologyQueueJob>): Promise<void> {
    const { eventId, userId, mode } = job.data;

    try {
      const event = await this.eventsRepo.findOne({ where: { id: eventId } });
      if (!event) {
        this.logger.warn(
          `Skip ontology processing for job ${job.id}: event ${eventId} not found`,
        );
        return;
      }

      const owner = await this.usersService.findOne(userId);
      if (!owner) {
        this.logger.warn(
          `Skip ontology processing for job ${job.id}: user ${userId} not found`,
        );
        return;
      }

      const nerResult = await this.resolveEventNerResult(event, owner);
      if (!nerResult) {
        this.logger.warn(
          `Skip ontology processing for job ${job.id}: failed to prepare NER result for event ${eventId}`,
        );
        await this.markEventCacheStatus(eventId, 'error');
        return;
      }

      await this.ontologyService.processEventOntology(owner, event, nerResult, {
        mode,
      });
      await this.markEventCacheStatus(eventId, 'ready');
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Ontology job ${job.id} failed for event ${eventId}: ${err?.message ?? err}`,
        err?.stack,
      );
      await this.markEventCacheStatus(eventId, 'error');
      throw error;
    }
  }

  private async resolveEventNerResult(
    event: Event,
    owner: User,
  ): Promise<NERResponseDto | null> {
    const normalizedTitle = normalizeEventTitle(event.title);
    if (!normalizedTitle) {
      return null;
    }

    let cacheKey = event.nerCacheKey?.trim() ?? null;
    if (!cacheKey) {
      cacheKey = buildEventNerCacheKey(event.id, normalizedTitle);
      await this.eventsRepo.update(event.id, {
        nerCacheKey: cacheKey,
        nerCacheStatus: 'pending',
      });
      event.nerCacheKey = cacheKey;
    }

    const cached =
      cacheKey !== null
        ? await this.nerCacheService.resolve(cacheKey, owner.id)
        : null;
    if (cacheKey && cached) {
      await this.nerCacheService.refreshTTL(
        cacheKey,
        EVENT_NER_CACHE_TTL_SECONDS,
      );
      return cached;
    }

    const nerResult = await this.suggestionsService.runNER({
      text: normalizedTitle,
    });

    if (cacheKey) {
      await this.nerCacheService.store(owner.id, normalizedTitle, nerResult, {
        token: cacheKey,
        ttlSeconds: EVENT_NER_CACHE_TTL_SECONDS,
      });
    }

    return nerResult;
  }

  private async markEventCacheStatus(
    eventId: string,
    status: EventNerCacheStatus,
  ): Promise<void> {
    await this.eventsRepo.update(eventId, { nerCacheStatus: status });
  }
}
