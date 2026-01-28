import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { CONCEPT_TYPE_LABELS } from './constants/concept.types';
import { UnclassifiedQueryDto } from './dto/unclassified-query.dto';

type OClassRow = {
  id: string;
  labelKo?: string | null;
  labelEn?: string | null;
  facet?: string | null;
  kind?: string | null;
  isRoot?: boolean | null;
  description?: string | null;
  seedVersion?: string | null;
};

type OClassEdgeRow = {
  child: string;
  parent: string;
};

@Injectable()
export class OntologyAdminService {
  constructor(private readonly neo4j: Neo4jService) {}

  async getSnapshot() {
    const classesCypher = `
      MATCH (c:OClass)
      RETURN {
        id: c.id,
        labelKo: c.labelKo,
        labelEn: c.labelEn,
        facet: c.facet,
        kind: c.kind,
        isRoot: c.isRoot,
        description: c.description,
        seedVersion: c.seedVersion
      } AS c
      ORDER BY c.facet, c.isRoot DESC, c.id
    `;

    const edgesCypher = `
      MATCH (child:OClass)-[:OSUBCLASS_OF]->(parent:OClass)
      RETURN { child: child.id, parent: parent.id } AS e
      ORDER BY child.id, parent.id
    `;

    const classesRes = await this.neo4j.run(classesCypher, {});
    const edgesRes = await this.neo4j.run(edgesCypher, {});

    const oClasses = classesRes.records.map(
      (r) => r.get('c') as OClassRow,
    );
    const subclassEdges = edgesRes.records.map(
      (r) => r.get('e') as OClassEdgeRow,
    );

    const seedVersions = Array.from(
      new Set(
        oClasses
          .map((c) => c.seedVersion)
          .filter((v): v is string => typeof v === 'string' && v.length > 0),
      ),
    );

    return {
      seedVersions,
      conceptTypes: CONCEPT_TYPE_LABELS,
      oClasses,
      subclassEdges,
    };
  }

  async getUnclassifiedConcepts(dto: UnclassifiedQueryDto) {
    const limit = dto.limit ?? 100;
    const minMentions = dto.minMentions ?? null;
    const since = dto.since ?? null;
    const conceptType = dto.conceptType ?? null;

    const cypher = `
      MATCH (c:Concept)
      WHERE NOT EXISTS {
        MATCH (c)-[r:CLASSIFIED_AS]->(:OClass)
        WHERE coalesce(r.active, true) = true
      }
      AND (
        ($conceptType IS NOT NULL AND c.type = $conceptType)
        OR ($conceptType IS NULL AND c.type <> 'Activity')
      )

      OPTIONAL MATCH (e:Event)-[:MENTIONS]->(c)
      WHERE $since IS NULL OR e.startTime >= datetime($since)
      WITH c,
           count(e) AS mentionCount,
           max(e.startTime) AS lastMentionedAt
      WHERE $minMentions IS NULL OR mentionCount >= $minMentions
      RETURN {
        name: c.name,
        type: c.type,
        createdAt: c.createdAt,
        mentionCount: mentionCount,
        lastMentionedAt: lastMentionedAt
      } AS row
      ORDER BY row.lastMentionedAt DESC NULLS LAST, row.mentionCount DESC
      LIMIT $limit
    `;

    const res = await this.neo4j.run(cypher, {
      limit,
      minMentions,
      since,
      conceptType,
    });

    return res.records.map((r) => r.get('row'));
  }
}
