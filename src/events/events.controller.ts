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
import {
  RequestWithUser,
  getUserIdOrThrow,
} from 'src/common/utils/request-user';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateEventDto) {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.create(userId, dto);
  }

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.findOneByUser(userId, id);
  }

  @Patch(':id')
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.remove(userId, id);
  }
}

type AuthenticatedRequest = RequestWithUser;
