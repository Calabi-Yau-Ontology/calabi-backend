import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OntologyRun } from './entities/ontology-run.entity';
import { CreateOntologyRunDto } from './dto/create-ontology-run.dto';
import { ConfirmOntologyRunDto } from './dto/confirm-ontology-run.dto';
import { ListOntologyRunsDto } from './dto/list-ontology-runs.dto';
import { OntologyRunStatus } from './constants/ontology-run.constants';

@Injectable()
export class OntologyRunService {
  constructor(
    @InjectRepository(OntologyRun)
    private readonly runRepo: Repository<OntologyRun>,
  ) {}

  async createRun(dto: CreateOntologyRunDto): Promise<OntologyRun> {
    const run = this.runRepo.create({
      kind: dto.kind,
      status: 'proposed' as OntologyRunStatus,
      inputJson: dto.input ?? null,
      snapshotJson: dto.snapshot ?? null,
      proposeJson: dto.propose ?? null,
      notes: dto.notes ?? null,
    });
    return this.runRepo.save(run);
  }

  async listRuns(dto: ListOntologyRunsDto): Promise<OntologyRun[]> {
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;

    const qb = this.runRepo
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (dto.kind) qb.andWhere('r.kind = :kind', { kind: dto.kind });
    if (dto.status) qb.andWhere('r.status = :status', { status: dto.status });

    return qb.getMany();
  }

  async getRun(id: string): Promise<OntologyRun> {
    const run = await this.runRepo.findOne({ where: { id } });
    if (!run) throw new NotFoundException(`Ontology run not found: ${id}`);
    return run;
  }

  async confirmRun(
    id: string,
    dto: ConfirmOntologyRunDto,
  ): Promise<OntologyRun> {
    const run = await this.getRun(id);
    run.confirmJson = dto.confirm ?? run.confirmJson ?? null;
    run.diffJson = dto.diff ?? run.diffJson ?? null;
    run.notes = dto.notes ?? run.notes ?? null;
    run.status = 'confirmed' as OntologyRunStatus;
    return this.runRepo.save(run);
  }
}
