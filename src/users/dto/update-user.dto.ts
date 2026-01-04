import { PartialType, PickType } from '@nestjs/swagger';
import { UserCredentialsDto } from './user-credentials.dto';

export class UpdateUserDto extends PartialType(
  PickType(UserCredentialsDto, ['password'] as const),
) {}
