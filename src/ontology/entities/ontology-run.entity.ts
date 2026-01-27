import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ONTOLOGY_RUN_KINDS,
  ONTOLOGY_RUN_STATUSES,
} from '../constants/ontology-run.constants';
import type {
  OntologyRunKind,
  OntologyRunStatus,
} from '../constants/ontology-run.constants';

@Entity('ontology_runs')
export class OntologyRun {
  @ApiProperty({ description: 'Run ID', format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'Run 종류',
    enum: ONTOLOGY_RUN_KINDS,
  })
  @Column({ type: 'varchar', length: 32 })
  kind!: OntologyRunKind;

  @ApiProperty({
    description: 'Run 상태',
    enum: ONTOLOGY_RUN_STATUSES,
  })
  @Column({ type: 'varchar', length: 24, default: 'proposed' })
  status!: OntologyRunStatus;

  @ApiPropertyOptional({ description: '입력 payload (CQ 목록 또는 concept 목록)' })
  @Column({ type: 'jsonb', nullable: true })
  inputJson?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'Snapshot JSON (OClass/edges 등)' })
  @Column({ type: 'jsonb', nullable: true })
  snapshotJson?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'LLM propose 원본' })
  @Column({ type: 'jsonb', nullable: true })
  proposeJson?: Record<string, any> | null;

  @ApiPropertyOptional({ description: '운영자 confirm 결과' })
  @Column({ type: 'jsonb', nullable: true })
  confirmJson?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'propose ↔ confirm diff (선택)' })
  @Column({ type: 'jsonb', nullable: true })
  diffJson?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'apply 요청 payload' })
  @Column({ type: 'jsonb', nullable: true })
  applyRequestJson?: Record<string, any> | null;

  @ApiPropertyOptional({ description: 'apply 결과' })
  @Column({ type: 'jsonb', nullable: true })
  applyResultJson?: Record<string, any> | null;

  @ApiPropertyOptional({ description: '운영자 메모' })
  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @ApiProperty({ description: '생성 시각' })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({ description: '수정 시각' })
  @UpdateDateColumn()
  updatedAt!: Date;
}
