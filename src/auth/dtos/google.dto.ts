import { IsEmail, IsOptional, IsString } from 'class-validator';

export class GoogleProfile {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  picture?: string;

  @IsString()
  accessToken!: string;
}
