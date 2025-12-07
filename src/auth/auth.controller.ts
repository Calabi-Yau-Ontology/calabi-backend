import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthUser } from './auth-user.decorator';
import { GoogleProfile } from './dtos/google.dto';
import { JwtAuthGuard } from './jwt/jwt.guard';
import { LoginOutput } from './dtos/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Guard redirects to Google OAuth consent screen.
  }

  @Get('google/redirect')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@AuthUser() profile: GoogleProfile): Promise<LoginOutput> {
    return this.authService.loginWithGoogle(profile);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@AuthUser() user: User) {
    return this.authService.getProfile(user);
  }
}
