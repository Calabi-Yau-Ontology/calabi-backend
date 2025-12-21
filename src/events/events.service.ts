import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UsersService } from '../users/users.service';
import { OntologyService } from 'src/ontology/ontology.service';
import { SuggestionsService } from 'src/suggestions/suggestions.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    private readonly usersService: UsersService,
    private readonly ontologyService: OntologyService,
    private readonly suggestionsService: SuggestionsService,
  ) {}

  async create(userId: string, dto: CreateEventDto): Promise<Event> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const event = this.eventsRepo.create({
      user,
      title: dto.title,
      description: dto.description,
      startTime: new Date(dto.startTime),
      endTime: dto.endTime ? new Date(dto.endTime) : null,
      location: dto.location,
    });

    // return this.eventsRepo.save(event);
    const saved = await this.eventsRepo.save(event);

    // NER 실행
    const nerResult = await this.suggestionsService.runNer({
      text: `${saved.title ?? ''}${saved.description ? '; ' + saved.description : ''}`.trim(),
    });

    // Ontology 반영
    await this.ontologyService.processEventOntology(saved.user, saved, nerResult);

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
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateEventDto,
  ): Promise<Event> {
    const event = await this.findOneByUser(userId, id);

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.startTime !== undefined)
      event.startTime = new Date(dto.startTime);
    if (dto.endTime !== undefined)
      event.endTime = dto.endTime ? new Date(dto.endTime) : null;
    if (dto.location !== undefined) event.location = dto.location;
    
    // return this.eventsRepo.save(event);
    const saved = await this.eventsRepo.save(event);

    // NER 실행
    const nerResult = await this.suggestionsService.runNer({
      text: `${saved.title ?? ''}${saved.description ? '; ' + saved.description : ''}`.trim(),
    });

    // Ontology 반영
    await this.ontologyService.processEventOntology(saved.user, saved, nerResult);

    return saved;
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const event = await this.findOneByUser(userId, id);
    const eventId = event.id;
    await this.eventsRepo.remove(event);
    await this.ontologyService.removeEvent(eventId);
    return { deleted: true };
  }
}
