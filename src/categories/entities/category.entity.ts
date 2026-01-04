import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('categories')
export class Category {
  @ApiProperty({
    description: '카테고리 ID',
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: '소유 사용자 정보',
    type: () => User,
  })
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user!: User;

  @ApiProperty({
    description: '카테고리 이름',
  })
  @Column()
  name!: string;

  @ApiProperty({
    description: '카테고리 색상',
    example: '#3b82f6',
  })
  @Column({ length: 7 })
  color!: string;

  @ApiProperty({
    description: '노출 여부',
    default: true,
  })
  @Column({ default: true })
  isVisible!: boolean;

  @ApiProperty({
    description: '기본 카테고리 여부',
    default: false,
  })
  @Column({ default: false })
  isDefault!: boolean;

  @ApiProperty({
    description: '생성일',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    description: '수정일',
  })
  @UpdateDateColumn()
  updatedAt!: Date;
}
