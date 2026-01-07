import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event } from './entities/event.entity';
import { Category } from '../categories/entities/category.entity';
import { UsersModule } from 'src/users/users.module';
import { OntologyModule } from 'src/ontology/ontology.module';
import { ONTOLOGY_QUEUE_NAME } from 'src/ontology/types/ontology-queue-job';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Category]),
    UsersModule,
    OntologyModule,
    BullModule.registerQueue({ name: ONTOLOGY_QUEUE_NAME }),
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
