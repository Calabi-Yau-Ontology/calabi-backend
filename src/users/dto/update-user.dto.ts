import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { PickType } from '@nestjs/mapped-types';

export class UpdateUserDto extends PartialType(
    PickType(CreateUserDto, ['password'] as const),
) {}
