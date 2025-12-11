import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { SuggestRequestDto } from './dto/suggest-request.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('suggest')
  async suggest(@Request() req: any, @Query() dto: SuggestRequestDto) {
    const userId = req.user.id; // JwtStrategy에서 넣어준 값
    return this.suggestionsService.runSuggest(userId, dto);
  }
}
