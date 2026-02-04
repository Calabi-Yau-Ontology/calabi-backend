import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { OntologyRunService } from './ontology-run.service';
import { OntologyRun } from './entities/ontology-run.entity';
import { ApplyOntologyRunDto } from './dto/apply-ontology-run.dto';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { ClassificationRepository } from './classification.repository';

describe('OntologyRunService.applyRun', () => {
  let service: OntologyRunService;
  let runRepo: jest.Mocked<Repository<OntologyRun>>;
  let neo4j: jest.Mocked<Neo4jService>;

  const buildRun = (status: OntologyRun['status']): OntologyRun =>
    ({
      id: 'run-1',
      kind: 'cq_propose',
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as OntologyRun;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OntologyRunService,
        {
          provide: getRepositoryToken(OntologyRun),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: Neo4jService,
          useValue: {
            withSession: jest.fn(),
          },
        },
        {
          provide: ClassificationRepository,
          useValue: {
            buildRunConceptClassificationCypher: jest
              .fn()
              .mockReturnValue('RETURN 1'),
            buildRunEventClassificationCypher: jest
              .fn()
              .mockReturnValue('RETURN 1'),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(OntologyRunService);
    runRepo = moduleRef.get(getRepositoryToken(OntologyRun));
    neo4j = moduleRef.get(Neo4jService);
  });

  it('applies successfully and commits transaction', async () => {
    const run = buildRun('confirmed');
    runRepo.findOne.mockResolvedValue(run);
    runRepo.save.mockImplementation(async (r) => r as OntologyRun);

    const tx = {
      run: jest
        .fn()
        .mockResolvedValueOnce({
          records: [{ get: () => 1 }],
        })
        .mockResolvedValueOnce({
          records: [
            {
              get: () => ({ applied: 1, missingConcept: 0, missingOClass: 0 }),
            },
          ],
        }),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    const session = {
      beginTransaction: jest.fn(() => tx),
    };
    neo4j.withSession.mockImplementation(async (fn) => fn(session as any));

    const dto: ApplyOntologyRunDto = {
      oClassesUpsert: [
        { id: 'PhysicalActivity', labelKo: '운동', facet: 'Activity' },
      ],
      classificationsUpsert: [
        {
          conceptType: 'Activity',
          conceptName: 'climbing',
          oClassId: 'PhysicalActivity',
          source: 'llm',
          confidence: 0.9,
        },
      ],
    };

    const result = await service.applyRun(run.id, dto);

    expect(result.status).toBe('applied');
    expect(tx.commit).toHaveBeenCalledTimes(1);
    expect(tx.rollback).not.toHaveBeenCalled();
    expect(runRepo.save).toHaveBeenCalled();
  });

  it('rolls back and marks failed on error', async () => {
    const run = buildRun('confirmed');
    runRepo.findOne.mockResolvedValue(run);
    runRepo.save.mockImplementation(async (r) => r as OntologyRun);

    const tx = {
      run: jest.fn().mockRejectedValueOnce(new Error('neo4j error')),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    const session = {
      beginTransaction: jest.fn(() => tx),
    };
    neo4j.withSession.mockImplementation(async (fn) => fn(session as any));

    const dto: ApplyOntologyRunDto = {
      oClassesUpsert: [{ id: 'Work' }],
    };

    await expect(service.applyRun(run.id, dto)).rejects.toThrow('neo4j error');
    expect(tx.rollback).toHaveBeenCalledTimes(1);
  });

  it('rejects apply if status is not confirmed', async () => {
    const run = buildRun('proposed');
    runRepo.findOne.mockResolvedValue(run);

    await expect(service.applyRun(run.id, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(neo4j.withSession).not.toHaveBeenCalled();
  });
});
