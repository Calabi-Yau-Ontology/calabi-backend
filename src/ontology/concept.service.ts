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
      MERGE (c:Concept { name: $name })
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

  async getByName(name: string): Promise<ConceptNode | null> {
    const cypher = `
      MATCH (c:Concept { name: $name })
      RETURN c {
        .id, .name, .type, .source,
        wikidataQid: c.wikidataQid,
        wikidataExpandedAt: c.wikidataExpandedAt
      } AS concept
      LIMIT 1
    `;
    const res = await this.neo4j.run(cypher, { name: name.trim() });
    return res.records.length ? res.records[0].get('concept') : null;
  }

  async markQidAndMaybeExpanded(params: {
    name: string;
    qid: string;
    expanded: boolean;
  }): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $name })
      SET c.wikidataQid = $qid,
          c.updatedAt = datetime()
      ${params.expanded ? 'SET c.wikidataExpandedAt = datetime()' : ''}
    `;
    await this.neo4j.run(cypher, { name: params.name.trim(), qid: params.qid });
  }

  async markExpanded(name: string): Promise<void> {
    const cypher = `
      MATCH (c:Concept { name: $name })
      SET c.wikidataExpandedAt = datetime(),
          c.updatedAt = datetime()
    `;
    await this.neo4j.run(cypher, { name: name.trim() });
  }
}
