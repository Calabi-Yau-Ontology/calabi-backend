import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = this.usersRepo.create({
      email: dto.email,
      passwordHash,
    });

    return this.usersRepo.save(user);
  }

  findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  findOne(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User | null> {
    const user = await this.findOne(id);
    if (!user) return null;

    if (dto.password) {
      const saltRounds = 10;
      user.passwordHash = await bcrypt.hash(dto.password, saltRounds);
    }

    return this.usersRepo.save(user);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    await this.usersRepo.delete(id);
    return { deleted: true };
  }

  /** 응답에서 passwordHash 제거용 헬퍼 */
  sanitize(user: User | null) {
    if (!user) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }

  sanitizeMany(users: User[]) {
    return users.map((u) => this.sanitize(u));
  }
}
