import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { GoogleProfile } from './dtos/google.dto';
import { LocalLoginDto, LoginOutput } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { ERROR_MESSAGES } from 'src/common/constants/error-messages';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async loginWithGoogle(profile: GoogleProfile): Promise<LoginOutput> {
    if (!profile.email) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.AUTH.GOOGLE_EMAIL_MISSING,
      );
    }

    let user = await this.usersService.findByEmail(profile.email);
    if (!user) {
      user = await this.usersService.create({
        email: profile.email,
        password: this.generateRandomPassword(),
      });
    }

    return this.buildLoginResponse(user);
  }

  async loginWithCredentials(dto: LocalLoginDto): Promise<LoginOutput> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    return this.buildLoginResponse(user);
  }

  async register(dto: RegisterDto): Promise<LoginOutput> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException(ERROR_MESSAGES.AUTH.EMAIL_IN_USE);
    }

    const user = await this.usersService.create(dto);
    return this.buildLoginResponse(user);
  }

  getProfile(user: User) {
    return this.usersService.sanitize(user);
  }

  private generateRandomPassword(): string {
    return randomBytes(32).toString('hex');
  }

  private buildLoginResponse(user: User): LoginOutput {
    const payload = {
      sub: user.id,
      email: user.email,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      access_token: accessToken,
      user: this.usersService.sanitize(user)!,
    };
  }
}
