import { Injectable, Logger } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { WikidataService } from 'src/wikidata/wikidata.service';
import { WikidataNeighbor } from 'src/wikidata/wikidata.types';
import { ConceptType } from '../constants/concept.types';

type ConceptRow = {
  name: string;
  type?: string;
  wikidataQid?: string | null;
  wikidataExpandedAt?: string | null;
};

@Injectable()
export class ExpansionService {
  private readonly logger = new Logger(ExpansionService.name);

  constructor(
    private readonly neo4j: Neo4jService,
    private readonly wikidata: WikidataService,
  ) {}

  async expandConceptByName(
    canonicalName: string,
    conceptType: ConceptType,
  ): Promise<{ expanded: boolean; reason: string }> {
    const name = canonicalName.trim();
    if (!name) return { expanded: false, reason: 'empty_name' };

    // 1) Concept load
    const concept = await this.getConceptRowByName(name, conceptType);
    if (!concept) return { expanded: false, reason: 'concept_not_found' };

    // 2) guard: expandedAt 있으면 재확장 금지
    if (concept.wikidataExpandedAt)
      return { expanded: false, reason: 'already_expanded' };

    // 3) qid 확보
    let qid = concept.wikidataQid?.trim() ?? '';
    // console.log('Existing QID:', qid);
    if (!qid) {
      qid = await this.resolveQidByCanonicalName(name);
      if (!qid) {
        await this.markWikidataError(name, conceptType, 'search_failed');
        return { expanded: false, reason: 'qid_not_found' };
      }
      await this.setConceptQid(name, conceptType, qid);
    }

    // 4) neighbors
    const edges = await this.wikidata.fetchNeighbors(qid);
    // console.log('Fetched edges:', edges);
    // console.log(`Fetched ${edges.length} neighbors for QID ${qid}`);
    if (!edges.length) {
      // neighbors 없더라도 지금은 “확장 완료”로 마킹
      await this.markExpanded(name, conceptType);
      return { expanded: true, reason: 'expanded_no_neighbors' };
    }

    // 5) upsert neighbors + relations (idempotent)
    await this.upsertNeighborhood(name, conceptType, edges);

    // 6) expandedAt mark (마지막에)
    await this.markExpanded(name, conceptType);

    return { expanded: true, reason: 'expanded' };
  }

  // ---------------- internal helpers ----------------

  private async getConceptRowByName(
    name: string,
    conceptType: ConceptType,
  ): Promise<ConceptRow | null> {
    const cypher = `
      MATCH (c:Concept { name: $name, type: $conceptType })
      RETURN {
        name: c.name,
        type: c.type,
        wikidataQid: c.wikidataQid,
        wikidataExpandedAt: c.wikidataExpandedAt
      } AS c
      LIMIT 1
    `;
    const res = await this.neo4j.run(cypher, { name, conceptType });
    return res.records.length ? (res.records[0].get('c') as ConceptRow) : null;
  }

  private async resolveQidByCanonicalName(name: string): Promise<string> {
    const results = await this.wikidata.searchByEnglishLabel(name, 5);
    if (!results.length) return '';

    // 결정론: (1) label이 정확히 name과 일치하는 것 우선, (2) 아니면 첫 번째
    const exact = results.find(
      (r) => r.label.toLowerCase() === name.toLowerCase(),
    );
    return (exact?.id ?? results[0].id).trim();
  }

  private async setConceptQid(
    name: string,
    conceptType: ConceptType,
    qid: string,
  ): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $name, type: $conceptType })
      SET c.wikidataQid = $qid,
          c.source = "wikidata",
          c.updatedAt = datetime()
    `;
    await this.neo4j.run(cypher, { name, conceptType, qid });
  }

  private async markExpanded(
    name: string,
    conceptType: ConceptType,
  ): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $name, type: $conceptType })
      SET c.wikidataExpandedAt = datetime(),
          c.updatedAt = datetime()
    `;
    await this.neo4j.run(cypher, { name, conceptType });
  }

  private async markWikidataError(
    name: string,
    conceptType: ConceptType,
    lastError: string,
  ): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $name, type: $conceptType })
      SET c.wikidataLastError = $lastError,
          c.updatedAt = datetime()
    `;
    await this.neo4j.run(cypher, { name, conceptType, lastError });
  }

  /**
   * 중심 Concept와 Concept 이웃들을 연결한다.
   * - Concept(name) ↔ Concept(wikidataQid) identity 연결
   * - 각 neighbor를 Concept으로 upsert + label 저장
   * - Concept와 neighbor를 INSTANCE_OF / SUBCLASS_OF ... 관계로 직접 연결
   */
  private async upsertNeighborhood(
    conceptName: string,
    conceptType: ConceptType,
    edges: WikidataNeighbor[],
  ): Promise<void> {
    if (!edges.length) return;

    // 각 neighbor를 Concept Node로 upsert하고 Concept에 rel 타입으로 연결
    const cypher = `
      UNWIND $edges AS e
      MATCH (c:Concept { name: $conceptName, type: $conceptType })
      MERGE (n:Concept { wikidataQid: e.neighborQid })
      ON CREATE SET
        n.name = e.neighborLabel,
        n.createdAt = datetime()
      SET n.updatedAt = datetime()

      FOREACH (_ IN CASE WHEN e.rel = 'INSTANCE_OF' THEN [1] ELSE [] END |
        MERGE (c)-[r:INSTANCE_OF]->(n)
        ON CREATE SET r.createdAt = datetime(), r.source = 'wikidata'
        SET r.updatedAt = datetime()
      )
      FOREACH (_ IN CASE WHEN e.rel = 'SUBCLASS_OF' THEN [1] ELSE [] END |
        MERGE (c)-[r:SUBCLASS_OF]->(n)
        ON CREATE SET r.createdAt = datetime(), r.source = 'wikidata'
        SET r.updatedAt = datetime()
      )
      FOREACH (_ IN CASE WHEN e.rel = 'HAS_PART' THEN [1] ELSE [] END |
        MERGE (c)-[r:HAS_PART]->(n)
        ON CREATE SET r.createdAt = datetime(), r.source = 'wikidata'
        SET r.updatedAt = datetime()
      )
      FOREACH (_ IN CASE WHEN e.rel = 'HAS_GOAL' THEN [1] ELSE [] END |
        MERGE (c)-[r:HAS_GOAL]->(n)
        ON CREATE SET r.createdAt = datetime(), r.source = 'wikidata'
        SET r.updatedAt = datetime()
      )
    `;

    await this.neo4j.run(cypher, {
      conceptName,
      conceptType,
      edges: edges.map((edge) => ({
        neighborQid: edge.neighborQid,
        neighborLabel: edge.neighborLabel,
        rel: edge.rel,
      })),
    });
  }
}
