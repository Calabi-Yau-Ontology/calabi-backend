import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@ApiTags('사용자')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: '사용자 목록',
    description: '모든 사용자를 조회합니다. 비밀번호는 포함되지 않습니다.',
  })
  @ApiOkResponse({ type: User, isArray: true })
  async findAll(): Promise<Array<Omit<User, 'passwordHash'>>> {
    const users = await this.usersService.findAll();
    return this.usersService.sanitizeMany(users);
  }

  @Get(':id')
  @ApiOperation({
    summary: '사용자 상세',
    description: 'ID로 사용자를 조회합니다. 존재하지 않으면 null을 반환합니다.',
  })
  @ApiOkResponse({
    type: User,
    description: '사용자를 찾으면 반환하며, 없으면 null을 반환합니다.',
  })
  async findOne(@Param('id') id: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.usersService.findOne(id);
    return this.usersService.sanitize(user);
  }
}
