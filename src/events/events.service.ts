import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ClientKafka } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import { Event } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UsersService } from '../users/users.service';
import { User } from 'src/users/entities/user.entity';
import { OntologyService } from 'src/ontology/ontology.service';
import { Category } from '../categories/entities/category.entity';
import { ERROR_MESSAGES } from 'src/common/constants/error-messages';
import {
  ONTOLOGY_QUEUE_NAME,
  OntologyQueueJob,
  PROCESS_EVENT_ONTOLOGY_JOB,
} from 'src/ontology/types/ontology-queue-job';
import { NerCacheService } from 'src/suggestions/cache/ner-cache.service';
import {
  buildEventNerCacheKey,
  normalizeEventTitle,
} from './utils/event-ner-cache.util';

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private kafkaReady = false;

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly usersService: UsersService,
    private readonly ontologyService: OntologyService,
    @InjectQueue(ONTOLOGY_QUEUE_NAME)
    private readonly ontologyQueue: Queue<OntologyQueueJob>,
    @Inject('EVENT_KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
    private readonly nerCacheService: NerCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.kafkaClient.connect();
      this.kafkaReady = true;
    } catch (error) {
      const err = error as Error;
      this.kafkaReady = false;
      this.logger.warn(
        `Kafka client connection skipped: ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.kafkaReady) {
      return;
    }
    try {
      await this.kafkaClient.close();
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Kafka client close failed: ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }

  async create(userId: string, dto: CreateEventDto): Promise<Event> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER.NOT_FOUND);
    }

    const category = await this.categoriesRepo.findOne({
      where: { id: dto.categoryId, user: { id: userId } },
    });
    if (!category) {
      throw new NotFoundException(ERROR_MESSAGES.CATEGORY.NOT_FOUND);
    }

    const event = this.eventsRepo.create({
      user,
      category,
      title: dto.title,
      description: dto.description,
      startTime: new Date(dto.startTime),
      endTime: dto.endTime ? new Date(dto.endTime) : null,
      location: dto.location,
    });

    const saved = await this.eventsRepo.save(event);

    await this.syncEventNerCacheMetadata(saved);

    this.dispatchEventSideEffects(user, saved, 'create');

    return saved;
  }

  findAllByUser(userId: string): Promise<Event[]> {
    return this.eventsRepo.find({
      where: {
        user: { id: userId },
      },
      order: { startTime: 'ASC' },
    });
  }

  async findOneByUser(userId: string, id: string): Promise<Event> {
    const event = await this.eventsRepo.findOne({
      where: { id, user: { id: userId } },
    });
    if (!event) throw new NotFoundException(ERROR_MESSAGES.EVENT.NOT_FOUND);
    return event;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateEventDto,
  ): Promise<Event> {
    const event = await this.findOneByUser(userId, id);
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER.NOT_FOUND);
    }

    const previousCacheKey = event.nerCacheKey ?? null;

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.startTime !== undefined) event.startTime = new Date(dto.startTime);
    if (dto.endTime !== undefined)
      event.endTime = dto.endTime ? new Date(dto.endTime) : null;
    if (dto.location !== undefined) event.location = dto.location;
    if (dto.categoryId !== undefined) {
      const category = await this.categoriesRepo.findOne({
        where: { id: dto.categoryId, user: { id: userId } },
      });
      if (!category) {
        throw new NotFoundException(ERROR_MESSAGES.CATEGORY.NOT_FOUND);
      }
      event.category = category;
    }

    const saved = await this.eventsRepo.save(event);

    await this.syncEventNerCacheMetadata(saved, previousCacheKey);

    this.dispatchEventSideEffects(user, saved, 'update');

    return saved;
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const event = await this.findOneByUser(userId, id);
    const eventId = event.id;
    const cacheKey = event.nerCacheKey ?? null;
    await this.eventsRepo.remove(event);
    if (cacheKey) {
      await this.removeEventCacheEntry(cacheKey);
    }
    try {
      await this.ontologyService.removeEvent(eventId);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to remove event ${eventId} from ontology: ${err?.message ?? err}`,
        err?.stack,
      );
    }
    return { deleted: true };
  }

  private dispatchEventSideEffects(
    user: User,
    event: Event,
    mode: 'create' | 'update',
  ): void {
    void Promise.allSettled([
      this.triggerOntologyProcessing(user, event, mode),
      this.publishToKafka(event, user, mode),
    ]);
  }

  private async triggerOntologyProcessing(
    user: User,
    event: Event,
    mode: 'create' | 'update',
  ): Promise<void> {
    const owner = event.user ?? user;
    if (!owner) {
      this.logger.warn(
        `Skip ontology processing for event ${event.id}: missing user context`,
      );
      return;
    }

    const jobPayload: OntologyQueueJob = {
      userId: owner.id,
      eventId: event.id,
      mode,
    };

    try {
      const existingJob = await this.ontologyQueue.getJob(event.id);
      if (existingJob) {
        await existingJob.remove();
      }

      await this.ontologyQueue.add(PROCESS_EVENT_ONTOLOGY_JOB, jobPayload, {
        jobId: event.id,
        delay: 1000,
        removeOnComplete: true,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to enqueue ontology job for event ${event.id}: ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }

  private async syncEventNerCacheMetadata(
    event: Event,
    previousKey?: string | null,
  ): Promise<void> {
    try {
      const normalizedTitle = normalizeEventTitle(event.title);
      if (!normalizedTitle) {
        if (previousKey) {
          await this.removeEventCacheEntry(previousKey);
        }
        await this.eventsRepo.update(event.id, {
          nerCacheKey: null,
          nerCacheStatus: null,
        });
        event.nerCacheKey = null;
        event.nerCacheStatus = null;
        return;
      }

      const nextKey = buildEventNerCacheKey(event.id, normalizedTitle);
      const hasNewKey = !previousKey || previousKey !== nextKey;
      if (hasNewKey && previousKey) {
        await this.removeEventCacheEntry(previousKey);
      }

      const nextStatus = hasNewKey
        ? ('pending' as const)
        : event.nerCacheStatus ?? ('ready' as const);

      await this.eventsRepo.update(event.id, {
        nerCacheKey: nextKey,
        nerCacheStatus: nextStatus,
      });

      event.nerCacheKey = nextKey;
      event.nerCacheStatus = nextStatus;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to update NER cache metadata for event ${event.id}: ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }

  private async removeEventCacheEntry(cacheKey?: string | null): Promise<void> {
    if (!cacheKey) {
      return;
    }
    try {
      await this.nerCacheService.remove(cacheKey);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to remove NER cache entry ${cacheKey}: ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }

  private async publishToKafka(
    event: Event,
    user: User,
    action: 'create' | 'update',
  ): Promise<void> {
    if (!this.kafkaReady) {
      return;
    }

    const payload = {
      eventId: event.id,
      userId: user.id,
      action,
      title: event.title,
      timestamp: Date.now(),
    };

    try {
      await lastValueFrom(
        this.kafkaClient.emit('event-stream', {
          key: event.id,
          value: JSON.stringify(payload),
        }),
      );
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Kafka publish failed for event ${event.id}: ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }
}
