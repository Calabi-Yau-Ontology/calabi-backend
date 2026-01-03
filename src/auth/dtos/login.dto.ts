import { PickType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { User } from '../../users/entities/user.entity';
import { UserCredentialsDto } from '../../users/dto/user-credentials.dto';

export class LocalLoginDto extends PickType(UserCredentialsDto, [
  'email',
  'password',
] as const) {}

export class LoginOutput {
  @ApiProperty({
    description: 'JWT 액세스 토큰',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  access_token!: string;

  @ApiProperty({
    description: '로그인한 사용자 정보',
    type: () => User,
  })
  user!: Omit<User, 'passwordHash'>;
}
