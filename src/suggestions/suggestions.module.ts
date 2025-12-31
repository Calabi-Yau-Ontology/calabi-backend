import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsController } from './suggestions.controller';
import { NerCacheService } from './cache/ner-cache.service';

@Module({
  imports: [HttpModule],
  controllers: [SuggestionsController],
  providers: [SuggestionsService, NerCacheService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
