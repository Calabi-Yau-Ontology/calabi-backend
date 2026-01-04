import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class UserCredentialsDto {
  @ApiProperty({
    description: '사용자 이메일',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: '비밀번호 (6자리 이상)',
    minLength: 6,
    example: 'hunter2!',
  })
  @IsString()
  @MinLength(6)
  password!: string;
}
