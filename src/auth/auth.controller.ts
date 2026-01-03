import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthUser } from './auth-user.decorator';
import { GoogleProfile } from './dtos/google.dto';
import { JwtAuthGuard } from './jwt/jwt.guard';
import { LocalLoginDto, LoginOutput } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { buildErrorSchema } from '../common/swagger/error-response.util';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { ERROR_MESSAGES } from 'src/common/constants/error-messages';

@ApiTags('인증')
@Controller('auth')
@ApiExtraModels(HttpErrorResponseDto)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: '이메일/비밀번호 로그인',
  })
  @ApiOkResponse({ type: LoginOutput })
  @ApiUnauthorizedResponse({
    description: '이메일 혹은 비밀번호 오류',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS,
      error: 'Unauthorized',
    }),
  })
  async login(@Body() dto: LocalLoginDto): Promise<LoginOutput> {
    return this.authService.loginWithCredentials(dto);
  }

  @Post('register')
  @ApiOperation({
    summary: '회원가입',
  })
  @ApiOkResponse({ type: LoginOutput })
  @ApiBadRequestResponse({
    description: '이미 가입된 이메일',
    ...buildErrorSchema({
      statusCode: 400,
      message: ERROR_MESSAGES.AUTH.EMAIL_IN_USE,
      error: 'Bad Request',
    }),
  })
  async register(@Body() dto: RegisterDto): Promise<LoginOutput> {
    return this.authService.register(dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: '구글 OAuth 시작',
    description: '구글 OAuth 동의 화면으로 리다이렉트합니다.',
  })
  @ApiOkResponse({
    description: 'Google Auth Guard에서 리다이렉트 처리',
  })
  googleLogin(): void {
    // Guard redirects to Google OAuth consent screen.
  }

  @Get('google/login')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: '구글 OAuth 콜백',
  })
  @ApiOkResponse({ type: LoginOutput })
  @ApiUnauthorizedResponse({
    description: '구글 계정에서 이메일을 받을 수 없음',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.GOOGLE_EMAIL_MISSING,
      error: 'Unauthorized',
    }),
  })
  async googleCallback(
    @AuthUser() profile: GoogleProfile,
  ): Promise<LoginOutput> {
    return this.authService.loginWithGoogle(profile);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '내 프로필 조회',
  })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: User })
  @ApiUnauthorizedResponse({
    description: 'JWT 미포함 또는 만료',
    ...buildErrorSchema({
      statusCode: 401,
      message: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
      error: 'Unauthorized',
    }),
  })
  me(@AuthUser() user: User): Omit<User, 'passwordHash'> | null {
    return this.authService.getProfile(user);
  }
}
