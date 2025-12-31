import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { AutocompleteRequestDto } from './dto/autocomplete-request.dto';
import { ConsistencyCheckRequestDto } from './dto/consistency-request.dto';
import type { RequestWithUser } from 'src/common/utils/request-user';
import { getUserIdOrThrow } from 'src/common/utils/request-user';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('autocomplete')
  async autocomplete(
    @Request() req: RequestWithUser,
    @Query() dto: AutocompleteRequestDto,
  ) {
    return this.suggestionsService.getRealtimeAutocomplete(
      getUserIdOrThrow(req),
      dto.fragment,
      dto.limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('consistency-check')
  async consistencyCheck(
    @Request() req: RequestWithUser,
    @Body() dto: ConsistencyCheckRequestDto,
  ) {
    return this.suggestionsService.runConsistencyCheck(
      getUserIdOrThrow(req),
      dto.text,
    );
  }
}
