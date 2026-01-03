import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './user.entity';

export type ThemeMode = 'light' | 'dark';
export type LanguageMode = 'ko' | 'en';

@Entity('user_settings')
export class UserSettings {
  @ApiProperty({
    description: '설정 ID',
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: '연결된 사용자',
    type: () => User,
    writeOnly: true,
  })
  @OneToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ApiProperty({
    description: '테마 모드',
    enum: ['light', 'dark'],
    default: 'light',
  })
  @Column({ type: 'enum', enum: ['light', 'dark'], default: 'light' })
  theme!: ThemeMode;

  @ApiProperty({
    description: '언어 설정',
    enum: ['ko', 'en'],
    default: 'ko',
  })
  @Column({ type: 'enum', enum: ['ko', 'en'], default: 'ko' })
  language!: LanguageMode;

  @ApiProperty({
    description: '생성일',
    type: String,
    format: 'date-time',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    description: '수정일',
    type: String,
    format: 'date-time',
  })
  @UpdateDateColumn()
  updatedAt!: Date;
}
