export const NEO4J_SCHEMA_STATEMENTS: string[] = [
  // Concept: canonical name+type unique
  `CREATE CONSTRAINT concept_name_type_unique IF NOT EXISTS
   FOR (c:Concept) REQUIRE (c.name, c.type) IS UNIQUE`,

  // Event 고유키
  `CREATE CONSTRAINT event_eventId_unique IF NOT EXISTS
   FOR (e:Event) REQUIRE e.eventId IS UNIQUE`,

  // User 고유키
  `CREATE CONSTRAINT user_id_unique IF NOT EXISTS
   FOR (u:User) REQUIRE u.id IS UNIQUE`,

  // 확장 상태 조회 최적화
  `CREATE INDEX concept_wikidata_qid_idx IF NOT EXISTS
   FOR (c:Concept) ON (c.wikidataQid)`,

  `CREATE INDEX concept_expanded_at_idx IF NOT EXISTS
   FOR (c:Concept) ON (c.wikidataExpandedAt)`
];
