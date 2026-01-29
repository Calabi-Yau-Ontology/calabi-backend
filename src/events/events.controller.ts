import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import {
  RequestWithUser,
  getUserIdOrThrow,
} from 'src/common/utils/request-user';
import { Event } from './entities/event.entity';
import { DeleteResultDto } from 'src/common/dto/delete-result.dto';
import { buildErrorSchema } from '../common/swagger/error-response.util';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { ERROR_MESSAGES } from 'src/common/constants/error-messages';

@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiTags('일정')
@ApiBearerAuth('access-token')
@ApiExtraModels(HttpErrorResponseDto)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({
    summary: '일정 생성',
    description: '카테고리를 포함한 새로운 일정을 생성합니다.',
  })
  @ApiCreatedResponse({ description: '생성된 일정', type: Event })
  @ApiBadRequestResponse({
    description: 'DTO 검증 실패',
    ...buildErrorSchema({
      statusCode: 400,
      message: ['title must be longer than or equal to 1 characters'],
      error: 'Bad Request',
    }),
  })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  @ApiNotFoundResponse({
    description: '사용자 또는 카테고리를 찾을 수 없음',
    ...buildErrorSchema({
      statusCode: 404,
      message: ERROR_MESSAGES.CATEGORY.NOT_FOUND,
      error: 'Not Found',
    }),
  })
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateEventDto,
  ): Promise<Event> {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: '일정 목록 조회',
    description: '사용자의 모든 일정을 시간순으로 조회합니다.',
  })
  @ApiOkResponse({ description: '일정 목록', type: Event, isArray: true })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  findAll(@Request() req: AuthenticatedRequest): Promise<Event[]> {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '일정 단건 조회',
    description: 'ID에 해당하는 일정을 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '조회할 일정 ID',
  })
  @ApiOkResponse({ description: '일정 정보', type: Event })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  @ApiNotFoundResponse({
    description: '일정을 찾을 수 없음',
    ...buildErrorSchema({
      statusCode: 404,
      message: ERROR_MESSAGES.EVENT.NOT_FOUND,
      error: 'Not Found',
    }),
  })
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<Event> {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.findOneByUser(userId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '일정 수정',
    description: '제목, 시간, 카테고리 등 일정을 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '수정할 일정 ID',
  })
  @ApiOkResponse({ description: '수정된 일정', type: Event })
  @ApiBadRequestResponse({
    description: 'DTO 검증 실패',
    ...buildErrorSchema({
      statusCode: 400,
      message: ['title must be longer than or equal to 1 characters'],
      error: 'Bad Request',
    }),
  })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  @ApiNotFoundResponse({
    description: '사용자/카테고리/일정을 찾을 수 없음',
    ...buildErrorSchema({
      statusCode: 404,
      message: ERROR_MESSAGES.EVENT.NOT_FOUND,
      error: 'Not Found',
    }),
  })
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<Event> {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '일정 삭제',
    description: 'ID로 일정을 삭제하고 연관된 온톨로지 데이터도 정리합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '삭제할 일정 ID',
  })
  @ApiOkResponse({ description: '삭제 결과', type: DeleteResultDto })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  @ApiNotFoundResponse({
    description: '일정을 찾을 수 없음',
    ...buildErrorSchema({
      statusCode: 404,
      message: ERROR_MESSAGES.EVENT.NOT_FOUND,
      error: 'Not Found',
    }),
  })
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<DeleteResultDto> {
    const userId = getUserIdOrThrow(req);
    return this.eventsService.remove(userId, id);
  }
}

type AuthenticatedRequest = RequestWithUser;
