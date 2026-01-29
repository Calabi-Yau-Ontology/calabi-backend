import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'src/neo4j/neo4j.service';
import { CONCEPT_TYPE_LABELS } from './constants/concept.types';
import {
  OntologySnapshotResponseDto,
  OClassDto,
  OClassEdgeDto,
} from './dto/ontology-snapshot.dto';
import { UnclassifiedContextDto } from './dto/unclassified-context.dto';
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
  childId: string;
  parentId: string;
};

@Injectable()
export class OntologyAdminService {
  constructor(private readonly neo4j: Neo4jService) {}

  async getSnapshot(): Promise<OntologySnapshotResponseDto> {
    const classesCypher = `
      MATCH (c:OClass)
      WHERE c.taxonomyVersion = 'v2'
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
      WHERE child.taxonomyVersion = 'v2'
        AND parent.taxonomyVersion = 'v2'
      RETURN { childId: child.id, parentId: parent.id } AS e
      ORDER BY child.id, parent.id
    `;

    const classesRes = await this.neo4j.run(classesCypher, {});
    const edgesRes = await this.neo4j.run(edgesCypher, {});

    const oClasses = classesRes.records.map((r) => r.get('c') as OClassRow);
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
    const seedVersion = seedVersions[0] ?? null;

    return {
      seedVersion,
      conceptTypes: CONCEPT_TYPE_LABELS,
      oClasses: oClasses as OClassDto[],
      subclassEdges: subclassEdges as OClassEdgeDto[],
    };
  }

  async getUnclassifiedContexts(
    dto: UnclassifiedQueryDto,
  ): Promise<UnclassifiedContextDto[]> {
    const limit = dto.limit ?? 100;
    const minMentions = dto.minMentions ?? null;
    const since = dto.since ?? null;

    const cypher = `
      MATCH (e:Event)
      WHERE $since IS NULL OR e.startTime >= datetime($since)
      OPTIONAL MATCH (e)-[ha:HAS_ACTIVITY]->(:OClass)
      WHERE coalesce(ha.active, true) = true
      WITH e, count(ha) > 0 AS eventClassified
      OPTIONAL MATCH (e)-[:MENTIONS]->(c:Concept)
      WHERE NOT EXISTS {
        MATCH (c)-[r:CLASSIFIED_AS]->(:OClass)
        WHERE coalesce(r.active, true) = true
      }
      WITH e, eventClassified,
           collect(
             DISTINCT CASE
               WHEN c IS NULL THEN NULL
               ELSE { name: c.name, type: c.type }
             END
           ) AS rawMentions
      WITH e, eventClassified,
           [m IN rawMentions WHERE m IS NOT NULL] AS mentions
      WHERE ($minMentions IS NULL OR size(mentions) >= $minMentions)
        AND (eventClassified = false OR size(mentions) > 0)
      RETURN {
        contextEvent: {
          id: e.eventId,
          title: e.title,
          startTime: toString(e.startTime),
          activityClassified: eventClassified
        },
        unclassifiedMentions: mentions
      } AS row
      ORDER BY e.startTime DESC
      LIMIT $limit
    `;

    const res = await this.neo4j.run(cypher, {
      limit,
      minMentions,
      since,
    });

    return res.records.map((r) => r.get('row') as UnclassifiedContextDto);
  }
}
