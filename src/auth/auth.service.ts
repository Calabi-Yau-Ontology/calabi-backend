import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { GoogleProfile } from './dtos/google.dto';
import { LoginOutput } from './dtos/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async loginWithGoogle(profile: GoogleProfile): Promise<LoginOutput> {
    if (!profile.email) {
      throw new UnauthorizedException('Google 계정에서 이메일을 받을 수 없습니다.');
    }

    let user = await this.usersService.findByEmail(profile.email);
    if (!user) {
      user = await this.usersService.create({
        email: profile.email,
        password: this.generateRandomPassword(),
      });
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      access_token: accessToken,
      user: this.usersService.sanitize(user)!,
    };
  }

  getProfile(user: User) {
    return this.usersService.sanitize(user);
  }

  private generateRandomPassword(): string {
    return randomBytes(32).toString('hex');
  }
}
