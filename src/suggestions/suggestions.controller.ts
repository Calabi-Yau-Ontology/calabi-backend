// src/suggestions/suggestions.controller.ts
import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { SuggestRequestDto } from './dto/suggest-request.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  // 이미 있을 수 있는 엔드포인트:
  // @Post('ner')
  // async runNer(@Body() dto: RunNerDto) { ... }

  @UseGuards(JwtAuthGuard)
  @Post('suggest')
  async suggest(@Request() req: any, @Body() dto: SuggestRequestDto) {
    const userId = req.user.id; // JwtStrategy에서 넣어준 값
    return this.suggestionsService.runSuggest(userId, dto);
  }
}
