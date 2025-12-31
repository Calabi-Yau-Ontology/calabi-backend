import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleProfile } from '../../dtos/google.dto';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_REDIRECT_URI'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { displayName, name, emails, photos } = profile;
    if (!emails || emails.length === 0) {
      return done(
        new UnauthorizedException('Could not get email from Google account'),
        false,
      );
    }

    const fallbackName = [name?.familyName, name?.givenName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const resolvedName =
      displayName ?? (fallbackName || undefined) ?? emails[0].value;

    const user: GoogleProfile = {
      email: emails[0].value,
      name: resolvedName,
      picture: photos?.[0]?.value,
      accessToken,
    };
    done(null, user);
  }
}
