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
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import {
  RequestWithUser,
  getUserIdOrThrow,
} from 'src/common/utils/request-user';
import { Category } from './entities/category.entity';
import { DeleteResultDto } from 'src/common/dto/delete-result.dto';
import { buildErrorSchema } from '../common/swagger/error-response.util';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { ERROR_MESSAGES } from 'src/common/constants/error-messages';

@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiTags('카테고리')
@ApiBearerAuth('access-token')
@ApiExtraModels(HttpErrorResponseDto)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({
    summary: '카테고리 생성',
    description: '새로운 일정 카테고리를 생성합니다.',
  })
  @ApiCreatedResponse({ description: '생성된 카테고리', type: Category })
  @ApiBadRequestResponse({
    description: 'DTO 검증 실패',
    ...buildErrorSchema({
      statusCode: 400,
      message: ['name must be longer than or equal to 1 characters'],
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
    description: '사용자를 찾을 수 없음',
    ...buildErrorSchema({
      statusCode: 404,
      message: ERROR_MESSAGES.USER.NOT_FOUND,
      error: 'Not Found',
    }),
  })
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCategoryDto,
  ): Promise<Category> {
    const userId = getUserIdOrThrow(req);
    return this.categoriesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: '카테고리 목록 조회',
    description: '사용자에게 연결된 모든 일정 카테고리를 조회합니다.',
  })
  @ApiOkResponse({
    description: '카테고리 목록',
    type: Category,
    isArray: true,
  })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  findAll(@Request() req: AuthenticatedRequest): Promise<Category[]> {
    const userId = getUserIdOrThrow(req);
    return this.categoriesService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '카테고리 단건 조회',
    description: '카테고리 ID에 해당하는 항목을 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '조회할 카테고리 ID',
  })
  @ApiOkResponse({ description: '카테고리 정보', type: Category })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  @ApiNotFoundResponse({
    description: '카테고리를 찾을 수 없음',
    ...buildErrorSchema({
      statusCode: 404,
      message: ERROR_MESSAGES.CATEGORY.NOT_FOUND,
      error: 'Not Found',
    }),
  })
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<Category> {
    const userId = getUserIdOrThrow(req);
    return this.categoriesService.findOneByUser(userId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '카테고리 수정',
    description: '카테고리 이름, 색상, 노출 여부 등을 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '수정할 카테고리 ID',
  })
  @ApiOkResponse({ description: '수정된 카테고리', type: Category })
  @ApiBadRequestResponse({
    description: 'DTO 검증 실패',
    ...buildErrorSchema({
      statusCode: 400,
      message: ['name must be longer than or equal to 1 characters'],
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
    description: '카테고리를 찾을 수 없음',
    ...buildErrorSchema({
      statusCode: 404,
      message: ERROR_MESSAGES.CATEGORY.NOT_FOUND,
      error: 'Not Found',
    }),
  })
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    const userId = getUserIdOrThrow(req);
    return this.categoriesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '카테고리 삭제',
    description: '선택한 카테고리를 삭제합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '삭제할 카테고리 ID',
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
    description: '카테고리를 찾을 수 없음',
    ...buildErrorSchema({
      statusCode: 404,
      message: ERROR_MESSAGES.CATEGORY.NOT_FOUND,
      error: 'Not Found',
    }),
  })
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<DeleteResultDto> {
    const userId = getUserIdOrThrow(req);
    return this.categoriesService.remove(userId, id);
  }
}

type AuthenticatedRequest = RequestWithUser;
