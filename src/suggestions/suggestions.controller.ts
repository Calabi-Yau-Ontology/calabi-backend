import { Body, Controller, Post } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { RunNerDto } from './dto/run-ner.dto';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  /**
   * 프록시 엔드포인트:
   * Nest → Calabi-ML /nlp/ner 호출
   */
  @Post('ner')
  async runNer(@Body() dto: RunNerDto) {
    return this.suggestionsService.runNer(dto);
  }
}
