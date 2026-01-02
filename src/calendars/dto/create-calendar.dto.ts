import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCalendarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsHexColor()
  color!: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
