import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
// import { UserSettings } from './user-settings.entity';

@Entity('users')
export class User {
  @ApiProperty({
    description: '사용자 ID',
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: '사용자 이메일',
    example: 'user@example.com',
  })
  @Column({ unique: true })
  email!: string;

  @ApiProperty({
    description: '암호화된 비밀번호',
    writeOnly: true,
  })
  @Column()
  passwordHash!: string;

  @ApiProperty({
    description: '가입일',
    type: String,
    format: 'date-time',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    description: '최근 수정일',
    type: String,
    format: 'date-time',
  })
  @UpdateDateColumn()
  updatedAt!: Date;

  // @ApiProperty({
  //   description: '사용자 설정',
  //   type: () => UserSettings,
  //   required: false,
  // })
  // @OneToOne(() => UserSettings, (settings) => settings.user, { nullable: true })
  // settings?: UserSettings;
}
