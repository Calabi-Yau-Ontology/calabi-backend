import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateCategoryDto) {
    const userId = req.user.id;
    return this.categoriesService.create(userId, dto);
  }

  @Get()
  findAll(@Request() req: any) {
    const userId = req.user.id;
    return this.categoriesService.findAllByUser(userId);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.categoriesService.findOneByUser(userId, id);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const userId = req.user.id;
    return this.categoriesService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.categoriesService.remove(userId, id);
  }
}
