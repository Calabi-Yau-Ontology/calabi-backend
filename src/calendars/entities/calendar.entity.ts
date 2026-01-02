import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('calendars')
export class Calendar {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user!: User;

  @Column()
  name!: string;

  @Column({ length: 7 })
  color!: string;

  @Column({ default: true })
  isVisible!: boolean;

  @Column({ default: false })
  isDefault!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
