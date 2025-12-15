import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WikidataService } from './wikidata.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'CalabiBot/0.1 (https://calabi.example; contact@example.com)',
      },
    }),
    ConfigModule,
  ],
  providers: [WikidataService],
  exports: [WikidataService],
})
export class WikidataModule {}