import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthUser } from './auth-user.decorator';
import { GoogleProfile } from './dtos/google.dto';
import { JwtAuthGuard } from './jwt/jwt.guard';
import { LocalLoginDto, LoginOutput } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Get('google/login')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @AuthUser() profile: GoogleProfile,
  ): Promise<LoginOutput> {
    return this.authService.loginWithGoogle(profile);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@AuthUser() user: User) {
    return this.authService.getProfile(user);
  }
}
