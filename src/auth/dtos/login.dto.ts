import { PickType } from '@nestjs/mapped-types';
import { IsString } from 'class-validator';
import { User } from '../../users/entities/user.entity';
import { UserCredentialsDto } from '../../users/dto/user-credentials.dto';

export class LocalLoginDto extends PickType(UserCredentialsDto, [
  'email',
  'password',
] as const) {}

export class LoginOutput {
  @IsString()
  access_token!: string;

  user!: Omit<User, 'passwordHash'>;
}
