import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { Calendar } from '../calendars/entities/calendar.entity';
import { UsersModule } from 'src/users/users.module';
import { OntologyModule } from 'src/ontology/ontology.module';
import { SuggestionsModule } from 'src/suggestions/suggestions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Calendar]), 
    UsersModule, 
    OntologyModule, 
    SuggestionsModule
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
