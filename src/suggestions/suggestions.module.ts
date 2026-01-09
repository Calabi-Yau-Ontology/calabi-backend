import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsController } from './suggestions.controller';
import { NerCacheService } from './cache/ner-cache.service';
import { Event } from 'src/events/entities/event.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Event])],
  controllers: [SuggestionsController],
  providers: [SuggestionsService, NerCacheService],
  exports: [SuggestionsService, NerCacheService],
})
export class SuggestionsModule {}
