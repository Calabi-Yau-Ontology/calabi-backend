import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly usersService: UsersService,
    private readonly ontologyService: OntologyService,
    @InjectQueue(ONTOLOGY_QUEUE_NAME)
    private readonly ontologyQueue: Queue<OntologyQueueJob>,
  ) {}

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

    // return this.eventsRepo.save(event);
    const saved = await this.eventsRepo.save(event);

    // NER + 온톨로지 처리를 비동기로 큐잉하여 API 응답을 빠르게 반환
    void this.triggerOntologyProcessing(user, saved, 'create', dto.cacheToken);

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

    // return this.eventsRepo.save(event);
    const saved = await this.eventsRepo.save(event);

    // NER + 온톨로지 처리를 비동기로 큐잉하여 API 응답을 빠르게 반환
    void this.triggerOntologyProcessing(user, saved, 'update', dto.cacheToken);

    return saved;
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const event = await this.findOneByUser(userId, id);
    const eventId = event.id;
    await this.eventsRepo.remove(event);
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

  private async triggerOntologyProcessing(
    user: User,
    event: Event,
    mode: 'create' | 'update',
    cacheToken?: string | null,
  ): Promise<void> {
    const owner = event.user ?? user;
    if (!owner) {
      this.logger.warn(
        `Skip ontology processing for event ${event.id}: missing user context`,
      );
      return;
    }

    const normalizedToken = cacheToken?.trim();
    const jobPayload: OntologyQueueJob = {
      userId: owner.id,
      eventId: event.id,
      mode,
      cacheToken: normalizedToken?.length ? normalizedToken : null,
    };

    try {
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
}
