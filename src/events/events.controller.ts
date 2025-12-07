import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateEventDto) {
    const userId = req.user.userId;
    return this.eventsService.create(userId, dto);
  }

  @Get()
  findAll(@Request() req: any) {
    const userId = req.user.userId;
    return this.eventsService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.eventsService.findOneByUser(userId, id);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const userId = req.user.userId;
    return this.eventsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.eventsService.remove(userId, id);
  }
}
