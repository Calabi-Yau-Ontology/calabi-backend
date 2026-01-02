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
import { Calendar } from '../../calendars/entities/calendar.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user!: User;

  @ManyToOne(() => Calendar, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'calendarId' })
  calendar?: Calendar | null;

  @RelationId((event: Event) => event.calendar)
  calendarId?: string | null;

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
