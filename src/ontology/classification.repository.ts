import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { ConceptType } from './constants/concept.types';

export type AutoConceptClassificationParams = {
  conceptName: string;
  conceptType: ConceptType;
  oClassId: string;
  confidence: number;
  source: string;
  reason: string | null;
  expectedFacet: string | null;
};

export type AutoEventClassificationParams = {
  eventId: string;
  oClassId: string;
  confidence: number;
  source: string;
  reason: string | null;
};

@Injectable()
export class ClassificationRepository {
  private readonly logger = new Logger(ClassificationRepository.name);

  constructor(private readonly neo4j: Neo4jService) {}

  async applyAutoConceptClassification(
    params: AutoConceptClassificationParams,
  ): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $conceptName, type: $conceptType })
      MATCH (o:OClass { id: $oClassId })
      WHERE ($expectedFacet IS NULL OR o.facet = $expectedFacet)
        AND NOT (o)<-[:OSUBCLASS_OF]-(:OClass)
      OPTIONAL MATCH (c)-[r:CLASSIFIED_AS]->(:OClass)
      WHERE coalesce(r.active, true) = true
      WITH c, o, collect(r) AS activeRels
      WITH c, o, activeRels,
           [r IN activeRels WHERE coalesce(r.source, '') IN ['llm', 'auto']
             AND coalesce(toFloat(r.confidence), -1) < $confidence] AS replaceable,
           [r IN activeRels WHERE NOT (coalesce(r.source, '') IN ['llm', 'auto']
             AND coalesce(toFloat(r.confidence), -1) < $confidence)] AS blocked
      WITH c, o, activeRels, replaceable, blocked,
           CASE
             WHEN size(activeRels) = 0 THEN true
             WHEN size(blocked) = 0 AND size(replaceable) > 0 THEN true
             ELSE false
           END AS allowReplace
      FOREACH (_ IN CASE WHEN allowReplace AND size(replaceable) > 0 THEN [1] ELSE [] END |
        FOREACH (old IN replaceable |
          SET old.active = false, old.updatedAt = datetime()
        )
      )
      FOREACH (_ IN CASE WHEN allowReplace THEN [1] ELSE [] END |
        MERGE (c)-[rel:CLASSIFIED_AS]->(o)
        ON CREATE SET rel.createdAt = datetime()
        SET rel.updatedAt = datetime(),
            rel.active = true,
            rel.source = $source,
            rel.confidence = $confidence,
            rel.reason = $reason,
            rel.decidedAt = datetime()
      )
    `;

    try {
      await this.neo4j.run(cypher, params);
    } catch (err) {
      this.logger.warn(
        `Auto-classify failed for ${params.conceptType}::${params.conceptName} -> ${params.oClassId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async applyAutoEventClassification(
    params: AutoEventClassificationParams,
  ): Promise<void> {
    const cypher = `
      MATCH (e:Event { eventId: $eventId })
      MATCH (o:OClass { id: $oClassId })
      WHERE o.facet = 'Activity'
        AND NOT (o)<-[:OSUBCLASS_OF]-(:OClass)
      OPTIONAL MATCH (e)-[r:HAS_ACTIVITY]->(:OClass)
      WHERE coalesce(r.active, true) = true
      WITH e, o, collect(r) AS activeRels
      WITH e, o, activeRels,
           [r IN activeRels WHERE coalesce(r.source, '') IN ['llm', 'auto']
             AND coalesce(toFloat(r.confidence), -1) < $confidence] AS replaceable,
           [r IN activeRels WHERE NOT (coalesce(r.source, '') IN ['llm', 'auto']
             AND coalesce(toFloat(r.confidence), -1) < $confidence)] AS blocked
      WITH e, o, activeRels, replaceable, blocked,
           CASE
             WHEN size(activeRels) = 0 THEN true
             WHEN size(blocked) = 0 AND size(replaceable) > 0 THEN true
             ELSE false
           END AS allowReplace
      FOREACH (_ IN CASE WHEN allowReplace AND size(replaceable) > 0 THEN [1] ELSE [] END |
        FOREACH (old IN replaceable |
          SET old.active = false, old.updatedAt = datetime()
        )
      )
      FOREACH (_ IN CASE WHEN allowReplace THEN [1] ELSE [] END |
        MERGE (e)-[rel:HAS_ACTIVITY]->(o)
        ON CREATE SET rel.createdAt = datetime()
        SET rel.updatedAt = datetime(),
            rel.active = true,
            rel.source = $source,
            rel.confidence = $confidence,
            rel.reason = $reason,
            rel.decidedAt = datetime()
      )
    `;

    try {
      await this.neo4j.run(cypher, params);
    } catch (err) {
      this.logger.warn(
        `Auto-classify failed for event ${params.eventId} -> ${params.oClassId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  buildRunConceptClassificationCypher(): string {
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
      OPTIONAL MATCH (c)-[old:CLASSIFIED_AS]->(:OClass)
      WHERE coalesce(old.active, true) = true
      WITH row, c, o, missC, missO, wrongFacet, nonLeaf, applied, collect(old) AS activeRels
      FOREACH (old IN CASE
        WHEN $replaceActive AND c IS NOT NULL AND o IS NOT NULL THEN activeRels
        ELSE []
      END |
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

  buildRunEventClassificationCypher(): string {
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
      OPTIONAL MATCH (e)-[old:HAS_ACTIVITY]->(:OClass)
      WHERE coalesce(old.active, true) = true
      WITH row, e, o, missE, missO, wrongFacet, nonLeaf, applied, collect(old) AS activeRels
      FOREACH (old IN CASE
        WHEN $replaceActive AND e IS NOT NULL AND o IS NOT NULL THEN activeRels
        ELSE []
      END |
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
