import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { OntologyRun } from './entities/ontology-run.entity';
import { CreateOntologyRunDto } from './dto/create-ontology-run.dto';
import { ConfirmOntologyRunDto } from './dto/confirm-ontology-run.dto';
import { ListOntologyRunsDto } from './dto/list-ontology-runs.dto';
import { OntologyRunStatus } from './constants/ontology-run.constants';
import {
  ApplyOntologyRunDto,
  ClassificationUpsertDto,
  EventClassificationUpsertDto,
  OClassUpsertDto,
  SubclassEdgeUpsertDto,
} from './dto/apply-ontology-run.dto';

@Injectable()
export class OntologyRunService {
  constructor(
    @InjectRepository(OntologyRun)
    private readonly runRepo: Repository<OntologyRun>,
    private readonly neo4j: Neo4jService,
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
    if (!this.isConfirmable(run.status)) {
      throw new ConflictException(
        `Run ${id} cannot be confirmed from status: ${run.status}`,
      );
    }
    run.confirmJson = dto.confirm ?? run.confirmJson ?? null;
    run.diffJson = dto.diff ?? run.diffJson ?? null;
    run.notes = dto.notes ?? run.notes ?? null;
    run.status = 'confirmed' as OntologyRunStatus;
    return this.runRepo.save(run);
  }

  async applyRun(id: string, dto: ApplyOntologyRunDto): Promise<OntologyRun> {
    const run = await this.getRun(id);
    if (!this.isApplyable(run.status)) {
      throw new ConflictException(
        `Run ${id} cannot be applied from status: ${run.status}`,
      );
    }

    run.status = 'apply_requested' as OntologyRunStatus;
    run.applyRequestJson = dto as Record<string, any>;
    await this.runRepo.save(run);

    try {
      const result = await this.applyToNeo4j(dto, id);
      run.applyResultJson = result;
      run.status = 'applied' as OntologyRunStatus;
      return this.runRepo.save(run);
    } catch (e: any) {
      run.applyResultJson = {
        error: e?.message ?? String(e),
      };
      run.status = 'failed' as OntologyRunStatus;
      await this.runRepo.save(run);
      throw e;
    }
  }

  private isConfirmable(status: OntologyRunStatus): boolean {
    return status === 'proposed' || status === 'confirmed';
  }

  private isApplyable(status: OntologyRunStatus): boolean {
    return status === 'confirmed';
  }

  private async applyToNeo4j(dto: ApplyOntologyRunDto, runId: string) {
    const oClasses = dto.oClassesUpsert ?? [];
    const subclassEdges = dto.subclassEdgesUpsert ?? [];
    const classifications = dto.classificationsUpsert ?? [];
    const eventClassifications = dto.eventClassificationsUpsert ?? [];
    const replaceActive = dto.replaceActive !== false;

    return this.neo4j.withSession(async (session) => {
      const tx = session.beginTransaction();
      try {
        let oClassUpserted = 0;
        let subclassEdgesUpserted = 0;
        let classificationApplied = 0;
        let classificationSkippedMissingConcept = 0;
        let classificationSkippedMissingOClass = 0;
        let classificationSkippedWrongFacet = 0;
        let classificationSkippedNonLeaf = 0;
        let eventClassificationApplied = 0;
        let eventClassificationSkippedMissingEvent = 0;
        let eventClassificationSkippedMissingOClass = 0;
        let eventClassificationSkippedWrongFacet = 0;
        let eventClassificationSkippedNonLeaf = 0;

        if (oClasses.length) {
          const res = await tx.run(this.buildOClassUpsertCypher(), {
            rows: oClasses,
          });
          oClassUpserted = Number(res.records?.[0]?.get('count') ?? 0);
        }

        if (subclassEdges.length) {
          const res = await tx.run(this.buildSubclassUpsertCypher(), {
            rows: subclassEdges,
          });
          subclassEdgesUpserted = Number(res.records?.[0]?.get('count') ?? 0);
        }

        if (classifications.length) {
          const res = await tx.run(this.buildConceptClassificationCypher(), {
            rows: classifications,
            runId,
            replaceActive,
          });
          const row = res.records?.[0]?.get('r');
          if (row) {
            classificationApplied = Number(row.applied ?? 0);
            classificationSkippedMissingConcept = Number(
              row.missingConcept ?? 0,
            );
            classificationSkippedMissingOClass = Number(row.missingOClass ?? 0);
            classificationSkippedWrongFacet = Number(row.wrongFacet ?? 0);
            classificationSkippedNonLeaf = Number(row.nonLeaf ?? 0);
          }
        }

        if (eventClassifications.length) {
          const res = await tx.run(this.buildEventClassificationCypher(), {
            rows: eventClassifications,
            runId,
            replaceActive,
          });
          const row = res.records?.[0]?.get('r');
          if (row) {
            eventClassificationApplied = Number(row.applied ?? 0);
            eventClassificationSkippedMissingEvent = Number(
              row.missingEvent ?? 0,
            );
            eventClassificationSkippedMissingOClass = Number(
              row.missingOClass ?? 0,
            );
            eventClassificationSkippedWrongFacet = Number(row.wrongFacet ?? 0);
            eventClassificationSkippedNonLeaf = Number(row.nonLeaf ?? 0);
          }
        }

        await tx.commit();
        return {
          oClassUpserted,
          subclassEdgesUpserted,
          classificationApplied,
          classificationSkippedMissingConcept,
          classificationSkippedMissingOClass,
          classificationSkippedWrongFacet,
          classificationSkippedNonLeaf,
          eventClassificationApplied,
          eventClassificationSkippedMissingEvent,
          eventClassificationSkippedMissingOClass,
          eventClassificationSkippedWrongFacet,
          eventClassificationSkippedNonLeaf,
          replaceActive,
        };
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    });
  }

  private buildOClassUpsertCypher() {
    return `
      UNWIND $rows AS row
      MERGE (c:OClass { id: row.id })
      ON CREATE SET
        c.createdAt = datetime()
      SET
        c.labelKo = coalesce(row.labelKo, c.labelKo),
        c.labelEn = coalesce(row.labelEn, c.labelEn),
        c.facet = coalesce(row.facet, c.facet),
        c.kind = coalesce(row.kind, c.kind),
        c.isRoot = coalesce(row.isRoot, c.isRoot),
        c.description = coalesce(row.description, c.description),
        c.seedVersion = coalesce(row.seedVersion, c.seedVersion),
        c.updatedAt = datetime()
      RETURN count(c) AS count
    `;
  }

  private buildSubclassUpsertCypher() {
    return `
      UNWIND $rows AS row
      MATCH (child:OClass { id: row.childId })
      MATCH (parent:OClass { id: row.parentId })
      MERGE (child)-[r:OSUBCLASS_OF]->(parent)
      ON CREATE SET r.createdAt = datetime()
      SET r.updatedAt = datetime()
      RETURN count(r) AS count
    `;
  }

  private buildConceptClassificationCypher() {
    return `
      UNWIND $rows AS row
      OPTIONAL MATCH (c:Concept { name: row.conceptName, type: row.conceptType })
      OPTIONAL MATCH (o:OClass { id: row.oClassId })
      WITH row, c, o,
           CASE WHEN c IS NULL THEN 1 ELSE 0 END AS missC,
           CASE WHEN o IS NULL THEN 1 ELSE 0 END AS missO,
           CASE
             WHEN o IS NOT NULL AND o.facet <> 'Entity' THEN 1
             ELSE 0
           END AS wrongFacet,
           CASE
             WHEN o IS NOT NULL AND o.facet = 'Entity'
               AND (o)<-[:OSUBCLASS_OF]-(:OClass) THEN 1
             ELSE 0
           END AS nonLeaf
      WITH row, c,
           CASE
             WHEN o IS NULL THEN NULL
             WHEN o.facet <> 'Entity' THEN NULL
             WHEN (o)<-[:OSUBCLASS_OF]-(:OClass) THEN NULL
             ELSE o
           END AS o,
           missC, missO, wrongFacet, nonLeaf,
           CASE WHEN c IS NOT NULL AND o IS NOT NULL THEN 1 ELSE 0 END AS applied
      FOREACH (_ IN CASE WHEN $replaceActive AND c IS NOT NULL AND o IS NOT NULL THEN [1] ELSE [] END |
        MATCH (c)-[old:CLASSIFIED_AS]->(:OClass)
        WHERE coalesce(old.active, true) = true
        SET old.active = false, old.updatedAt = datetime()
      )
      FOREACH (_ IN CASE WHEN c IS NOT NULL AND o IS NOT NULL THEN [1] ELSE [] END |
        MERGE (c)-[r:CLASSIFIED_AS]->(o)
        ON CREATE SET r.createdAt = datetime()
        SET r.updatedAt = datetime(),
            r.active = coalesce(row.active, true),
            r.runId = $runId,
            r.source = coalesce(row.source, 'llm'),
            r.confidence = row.confidence,
            r.decidedAt = CASE
              WHEN row.decidedAt IS NULL THEN datetime()
              ELSE datetime(row.decidedAt)
            END
      )
      RETURN {
        applied: sum(applied),
        missingConcept: sum(missC),
        missingOClass: sum(missO),
        wrongFacet: sum(wrongFacet),
        nonLeaf: sum(nonLeaf)
      } AS r
    `;
  }

  private buildEventClassificationCypher() {
    return `
      UNWIND $rows AS row
      OPTIONAL MATCH (e:Event { eventId: row.eventId })
      OPTIONAL MATCH (o:OClass { id: row.oClassId })
      WITH row, e, o,
           CASE WHEN e IS NULL THEN 1 ELSE 0 END AS missE,
           CASE WHEN o IS NULL THEN 1 ELSE 0 END AS missO,
           CASE
             WHEN o IS NOT NULL AND o.facet <> 'Activity' THEN 1
             ELSE 0
           END AS wrongFacet,
           CASE
             WHEN o IS NOT NULL AND o.facet = 'Activity'
               AND (o)<-[:OSUBCLASS_OF]-(:OClass) THEN 1
             ELSE 0
           END AS nonLeaf
      WITH row, e,
           CASE
             WHEN o IS NULL THEN NULL
             WHEN o.facet <> 'Activity' THEN NULL
             WHEN (o)<-[:OSUBCLASS_OF]-(:OClass) THEN NULL
             ELSE o
           END AS o,
           missE, missO, wrongFacet, nonLeaf,
           CASE WHEN e IS NOT NULL AND o IS NOT NULL THEN 1 ELSE 0 END AS applied
      FOREACH (_ IN CASE WHEN $replaceActive AND e IS NOT NULL AND o IS NOT NULL THEN [1] ELSE [] END |
        MATCH (e)-[old:HAS_ACTIVITY]->(:OClass)
        WHERE coalesce(old.active, true) = true
        SET old.active = false, old.updatedAt = datetime()
      )
      FOREACH (_ IN CASE WHEN e IS NOT NULL AND o IS NOT NULL THEN [1] ELSE [] END |
        MERGE (e)-[r:HAS_ACTIVITY]->(o)
        ON CREATE SET r.createdAt = datetime()
        SET r.updatedAt = datetime(),
            r.active = coalesce(row.active, true),
            r.runId = $runId,
            r.source = coalesce(row.source, 'llm'),
            r.confidence = row.confidence,
            r.decidedAt = CASE
              WHEN row.decidedAt IS NULL THEN datetime()
              ELSE datetime(row.decidedAt)
            END
      )
      RETURN {
        applied: sum(applied),
        missingEvent: sum(missE),
        missingOClass: sum(missO),
        wrongFacet: sum(wrongFacet),
        nonLeaf: sum(nonLeaf)
      } AS r
    `;
  }
}
