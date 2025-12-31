import { IsString, MinLength } from 'class-validator';

export class RunNERDto {
  @IsString()
  @MinLength(1)
  text!: string;
}
