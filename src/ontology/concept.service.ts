import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { ConceptType } from './constants/concept.types';

export type ConceptNode = {
  id: string;
  name: string; // canonical_en
  type: ConceptType;
  source: 'user' | 'wikidata';
  wikidataQid?: string | null;
  wikidataExpandedAt?: string | null;
};

@Injectable()
export class ConceptService {
  constructor(private readonly neo4j: Neo4jService) {}

  async upsertConcept(params: {
    name: string; // canonical_en
    type: ConceptType;
    source: 'user' | 'wikidata';
  }): Promise<ConceptNode> {
    const name = params.name.trim();
    if (!name) throw new Error('Concept name is empty');

    const cypher = `
      MERGE (c:Concept:${params.type} { name: $name, type: $type })
      ON CREATE SET
        c.id = randomUUID(),
        c.type = $type,
        c.source = $source,
        c.createdAt = datetime(),
        c.updatedAt = datetime()
      ON MATCH SET
        c.updatedAt = datetime()
      RETURN c {
        .id, .name, .type, .source,
        wikidataQid: c.wikidataQid,
        wikidataExpandedAt: c.wikidataExpandedAt
      } AS concept
    `;

    const result = await this.neo4j.run(cypher, {
      name,
      type: params.type,
      source: params.source,
    });

    return result.records[0].get('concept');
  }

  async getByName(name: string, type: ConceptType): Promise<ConceptNode | null> {
    const cypher = `
      MATCH (c:Concept { name: $name, type: $type })
      RETURN c {
        .id, .name, .type, .source,
        wikidataQid: c.wikidataQid,
        wikidataExpandedAt: c.wikidataExpandedAt
      } AS concept
      LIMIT 1
    `;
    const res = await this.neo4j.run(cypher, { name: name.trim(), type });
    return res.records.length ? res.records[0].get('concept') : null;
  }

  async markQidAndMaybeExpanded(params: {
    name: string;
    type: ConceptType;
    qid: string;
    expanded: boolean;
  }): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $name, type: $type })
      SET c.wikidataQid = $qid,
          c.updatedAt = datetime()
      ${params.expanded ? 'SET c.wikidataExpandedAt = datetime()' : ''}
    `;
    await this.neo4j.run(cypher, {
      name: params.name.trim(),
      type: params.type,
      qid: params.qid,
    });
  }

  async markExpanded(name: string, type: ConceptType): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $name, type: $type })
      SET c.wikidataExpandedAt = datetime(),
          c.updatedAt = datetime()
    `;
    await this.neo4j.run(cypher, { name: name.trim(), type });
  }
}
