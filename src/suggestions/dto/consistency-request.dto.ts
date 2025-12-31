import { IsString, MinLength } from 'class-validator';

export class ConsistencyCheckRequestDto {
  @IsString()
  @MinLength(1)
  text!: string;
}
