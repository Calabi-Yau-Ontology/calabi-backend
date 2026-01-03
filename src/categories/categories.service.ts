import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepo: Repository<Category>,
    private readonly usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const category = this.categoriesRepo.create({
      user,
      name: dto.name,
      color: dto.color,
      isVisible: dto.isVisible ?? true,
      isDefault: dto.isDefault ?? false,
    });

    return this.categoriesRepo.save(category);
  }

  async findAllByUser(userId: string): Promise<Category[]> {
    const categories = await this.categoriesRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'ASC' },
    });
    if (categories.length) return categories;

    const defaultCategory = await this.ensureDefaultCategory(userId);
    return defaultCategory ? [defaultCategory] : [];
  }

  async findOneByUser(userId: string, id: string): Promise<Category> {
    const category = await this.categoriesRepo.findOne({
      where: { id, user: { id: userId } },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOneByUser(userId, id);

    if (dto.name !== undefined) category.name = dto.name;
    if (dto.color !== undefined) category.color = dto.color;
    if (dto.isVisible !== undefined) category.isVisible = dto.isVisible;
    if (dto.isDefault !== undefined) category.isDefault = dto.isDefault;

    return this.categoriesRepo.save(category);
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const category = await this.findOneByUser(userId, id);
    await this.categoriesRepo.remove(category);
    return { deleted: true };
  }

  private async ensureDefaultCategory(
    userId: string,
  ): Promise<Category | null> {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const category = this.categoriesRepo.create({
      user,
      name: '일정',
      color: '#3b82f6',
      isVisible: true,
      isDefault: true,
    });

    return this.categoriesRepo.save(category);
  }
}
