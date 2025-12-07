import { IsString, MinLength } from 'class-validator';

export class RunNerDto {
  @IsString()
  @MinLength(1)
  text!: string;
}
