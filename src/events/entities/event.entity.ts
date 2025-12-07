import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user!: User;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'timestamptz' })
  startTime!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endTime?: Date | null;

  @Column({ type: 'text', nullable: true })
  location?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
