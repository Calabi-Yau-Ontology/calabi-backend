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

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('autocomplete')
  async autocomplete(
    @Request() req: { user: { id: string } },
    @Query() dto: AutocompleteRequestDto,
  ) {
    return this.suggestionsService.getRealtimeAutocomplete(
      req.user.id,
      dto.fragment,
      dto.limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('consistency-check')
  async consistencyCheck(
    @Request() req: { user: { id: string } },
    @Body() dto: ConsistencyCheckRequestDto,
  ) {
    return this.suggestionsService.runConsistencyCheck(req.user.id, dto.text);
  }
}
