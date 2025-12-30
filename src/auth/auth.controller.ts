import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthUser } from './auth-user.decorator';
import { GoogleProfile } from './dtos/google.dto';
import { JwtAuthGuard } from './jwt/jwt.guard';
import { LocalLoginDto, LoginOutput } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() dto: LocalLoginDto): Promise<LoginOutput> {
    return this.authService.loginWithCredentials(dto);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<LoginOutput> {
    return this.authService.register(dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Guard redirects to Google OAuth consent screen.
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @AuthUser() profile: GoogleProfile,
    @Res() res: Response,
  ): Promise<void> {
    const loginResult = await this.authService.loginWithGoogle(profile);

    const isProduction = this.configService.get<string>('NODE_ENV') === 'prod';
    res.cookie('access_token', loginResult.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });

    const frontendBaseUrl =
      this.configService.get<string>('frontend.baseUrl');
    const redirectPath =
      this.configService.get<string>('frontend.authRedirectPath') ?? '/calendar';

    const redirectUrl = new URL(redirectPath, frontendBaseUrl).toString();
    res.redirect(302, redirectUrl);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@AuthUser() user: User) {
    return this.authService.getProfile(user);
  }
}
