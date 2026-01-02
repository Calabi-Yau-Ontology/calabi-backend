import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Calendar } from './entities/calendar.entity';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class CalendarsService {
  constructor(
    @InjectRepository(Calendar)
    private readonly calendarsRepo: Repository<Calendar>,
    private readonly usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreateCalendarDto): Promise<Calendar> {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const calendar = this.calendarsRepo.create({
      user,
      name: dto.name,
      color: dto.color,
      isVisible: dto.isVisible ?? true,
      isDefault: dto.isDefault ?? false,
    });

    return this.calendarsRepo.save(calendar);
  }

  async findAllByUser(userId: string): Promise<Calendar[]> {
    const calendars = await this.calendarsRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
    });
    if (calendars.length) return calendars;

    const defaultCalendar = await this.ensureDefaultCalendar(userId);
    return defaultCalendar ? [defaultCalendar] : [];
  }

  async findOneByUser(userId: string, id: string): Promise<Calendar> {
    const calendar = await this.calendarsRepo.findOne({
      where: { id, user: { id: userId } },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');
    return calendar;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCalendarDto,
  ): Promise<Calendar> {
    const calendar = await this.findOneByUser(userId, id);

    if (dto.name !== undefined) calendar.name = dto.name;
    if (dto.color !== undefined) calendar.color = dto.color;
    if (dto.isVisible !== undefined) calendar.isVisible = dto.isVisible;
    if (dto.isDefault !== undefined) calendar.isDefault = dto.isDefault;

    return this.calendarsRepo.save(calendar);
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const calendar = await this.findOneByUser(userId, id);
    await this.calendarsRepo.remove(calendar);
    return { deleted: true };
  }

  private async ensureDefaultCalendar(userId: string): Promise<Calendar | null> {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const calendar = this.calendarsRepo.create({
      user,
      name: '일정',
      color: '#3b82f6',
      isVisible: true,
      isDefault: true,
    });

    return this.calendarsRepo.save(calendar);
  }
}
