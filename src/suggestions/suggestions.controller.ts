import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SuggestionsService } from './suggestions.service';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { AutocompleteRequestDto } from './dto/autocomplete-request.dto';
import { ConsistencyCheckRequestDto } from './dto/consistency-request.dto';
import {
  ConsistencyDecisionRequestDto,
  ConsistencyDecisionResponseDto,
} from './dto/consistency-decision.dto';
import type { RequestWithUser } from 'src/common/utils/request-user';
import { getUserIdOrThrow } from 'src/common/utils/request-user';
import { AutocompleteResponseDto } from './dto/autocomplete-response.dto';
import { ConsistencyCheckResponseDto } from './dto/consistency-response.dto';
import { buildErrorSchema } from '../common/swagger/error-response.util';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { ERROR_MESSAGES } from 'src/common/constants/error-messages';

@ApiTags('추천')
@ApiBearerAuth('access-token')
@ApiExtraModels(HttpErrorResponseDto)
@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('autocomplete')
  @ApiOperation({
    summary: '실시간 자동완성',
    description: 'surface form 자동완성 추천을 제공합니다.',
  })
  @ApiOkResponse({ type: AutocompleteResponseDto })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  async autocomplete(
    @Request() req: RequestWithUser,
    @Query() dto: AutocompleteRequestDto,
  ): Promise<AutocompleteResponseDto> {
    return this.suggestionsService.getRealtimeAutocomplete(
      getUserIdOrThrow(req),
      dto.fragment,
      dto.limit,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('consistency-check')
  @ApiOperation({
    summary: 'NER 일관성 검사',
    description: 'NER 결과 기반으로 추천 surface form을 반환합니다.',
  })
  @ApiOkResponse({ type: ConsistencyCheckResponseDto })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  async consistencyCheck(
    @Request() req: RequestWithUser,
    @Body() dto: ConsistencyCheckRequestDto,
  ): Promise<ConsistencyCheckResponseDto> {
    return this.suggestionsService.runConsistencyCheck(
      getUserIdOrThrow(req),
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('consistency-decision')
  @ApiOperation({
    summary: '추천 반영/무시 확정',
    description: '추천을 반영하거나 무시했음을 서버에 기록합니다.',
  })
  @ApiOkResponse({ type: ConsistencyDecisionResponseDto })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  async consistencyDecision(
    @Request() req: RequestWithUser,
    @Body() dto: ConsistencyDecisionRequestDto,
  ): Promise<ConsistencyDecisionResponseDto> {
    await this.suggestionsService.confirmConsistencyDecision(
      getUserIdOrThrow(req),
      dto,
    );
    return { acknowledged: true };
  }
}
