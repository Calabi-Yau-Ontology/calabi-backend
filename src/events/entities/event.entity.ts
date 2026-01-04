import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('events')
export class Event {
  @ApiProperty({
    description: '일정 ID',
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: '일정을 생성한 사용자',
    type: () => User,
  })
  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user!: User;

  @ApiProperty({
    description: '연결된 카테고리 정보',
    type: () => Category,
    nullable: true,
  })
  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category?: Category | null;

  @ApiProperty({
    description: '연결된 카테고리 ID',
    format: 'uuid',
    nullable: true,
  })
  @RelationId((event: Event) => event.category)
  categoryId?: string | null;

  @ApiProperty({
    description: '일정 제목',
  })
  @Column()
  title!: string;

  @ApiProperty({
    description: '일정 설명',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @ApiProperty({
    description: '시작 시각',
    type: String,
    format: 'date-time',
  })
  @Column({ type: 'timestamptz' })
  startTime!: Date;

  @ApiProperty({
    description: '종료 시각',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  @Column({ type: 'timestamptz', nullable: true })
  endTime?: Date | null;

  @ApiProperty({
    description: '장소',
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  location?: string | null;

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
