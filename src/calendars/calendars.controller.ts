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
import { CalendarsService } from './calendars.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';

@Controller('calendars')
@UseGuards(JwtAuthGuard)
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateCalendarDto) {
    const userId = req.user.id;
    return this.calendarsService.create(userId, dto);
  }

  @Get()
  findAll(@Request() req: any) {
    const userId = req.user.id;
    return this.calendarsService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.calendarsService.findOneByUser(userId, id);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarDto,
  ) {
    const userId = req.user.id;
    return this.calendarsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.calendarsService.remove(userId, id);
  }
}
