import { PartialType, PickType } from '@nestjs/mapped-types';
import { UserCredentialsDto } from './user-credentials.dto';

export class UpdateUserDto extends PartialType(
    PickType(UserCredentialsDto, ['password'] as const),
) {}
