import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * 이 컨트롤러는 지금은 간단 조회용 정도.
 * 회원가입/로그인은 AuthController에서 처리할 거고,
 * 나중에 필요하면 관리자용 API로 확장하자
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return this.usersService.sanitizeMany(users);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return this.usersService.sanitize(user);
  }
}
