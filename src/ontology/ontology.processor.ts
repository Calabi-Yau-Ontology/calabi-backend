import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from 'src/events/entities/event.entity';
import { SuggestionsService } from 'src/suggestions/suggestions.service';
import { UsersService } from 'src/users/users.service';
import { OntologyService } from './ontology.service';
import {
  ONTOLOGY_QUEUE_NAME,
  OntologyQueueJob,
  PROCESS_EVENT_ONTOLOGY_JOB,
} from './types/ontology-queue-job';

@Processor(ONTOLOGY_QUEUE_NAME)
export class OntologyProcessor {
  private readonly logger = new Logger(OntologyProcessor.name);

  constructor(
    private readonly ontologyService: OntologyService,
    private readonly suggestionsService: SuggestionsService,
    private readonly usersService: UsersService,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
  ) {}

  @Process({ name: PROCESS_EVENT_ONTOLOGY_JOB, concurrency: 1 })
  async handle(job: Job<OntologyQueueJob>): Promise<void> {
    const { eventId, userId, mode, cacheToken } = job.data;

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

      const normalizedToken = cacheToken?.trim();
      let nerResult =
        normalizedToken?.length && owner.id
          ? await this.suggestionsService.consumeCachedNER(
              normalizedToken,
              owner.id,
            )
          : null;

      if (!nerResult) {
        const text = (event.title ?? '').trim();
        nerResult = await this.suggestionsService.runNER({ text });
      }

      await this.ontologyService.processEventOntology(owner, event, nerResult, {
        mode,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Ontology job ${job.id} failed for event ${eventId}: ${err?.message ?? err}`,
        err?.stack,
      );
      throw error;
    }
  }
}
