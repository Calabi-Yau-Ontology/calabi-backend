import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
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
    ClientsModule.register([
      {
        name: 'EVENT_KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'calabi-backend-consumer',
          },
        },
      },
    ]),
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
