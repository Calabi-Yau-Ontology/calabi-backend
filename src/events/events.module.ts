import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { Category } from '../categories/entities/category.entity';
import { UsersModule } from 'src/users/users.module';
import { OntologyModule } from 'src/ontology/ontology.module';
import { SuggestionsModule } from 'src/suggestions/suggestions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Category]),
    UsersModule,
    OntologyModule,
    SuggestionsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
