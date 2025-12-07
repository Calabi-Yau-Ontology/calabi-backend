import { IsString } from 'class-validator';
import { User } from '../../users/entities/user.entity';

export class LoginOutput {
  @IsString()
  access_token!: string;

  user!: Omit<User, 'passwordHash'>;
}
