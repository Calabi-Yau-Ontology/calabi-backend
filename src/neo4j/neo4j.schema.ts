export const NEO4J_SCHEMA_STATEMENTS: string[] = [
  // ---- Meta ontology (taxonomy MVP) ----
  `CREATE CONSTRAINT oclass_id_unique IF NOT EXISTS
   FOR (c:OClass) REQUIRE c.id IS UNIQUE`,

  `CREATE INDEX oclass_facet_idx IF NOT EXISTS
   FOR (c:OClass) ON (c.facet)`,

  // Concept: canonical name+type unique
  `CREATE CONSTRAINT concept_name_type_unique IF NOT EXISTS
   FOR (c:Concept) REQUIRE (c.name, c.type) IS UNIQUE`,

  // SurfaceForm: unique key per concept + normalized value
  `CREATE CONSTRAINT surface_form_key_unique IF NOT EXISTS
   FOR (s:SurfaceForm) REQUIRE s.key IS UNIQUE`,

  `CREATE INDEX surface_form_normalized_idx IF NOT EXISTS
   FOR (s:SurfaceForm) ON (s.normalized)`,

  // Event 고유키
  `CREATE CONSTRAINT event_eventId_unique IF NOT EXISTS
   FOR (e:Event) REQUIRE e.eventId IS UNIQUE`,

  // User 고유키
  `CREATE CONSTRAINT user_id_unique IF NOT EXISTS
   FOR (u:User) REQUIRE u.id IS UNIQUE`,

  // 확장 상태 조회 최적화
  `DROP INDEX concept_wikidata_qid_idx IF EXISTS`,

  `CREATE CONSTRAINT concept_wikidata_qid_unique IF NOT EXISTS
   FOR (c:Concept) REQUIRE c.wikidataQid IS UNIQUE`,

  `CREATE INDEX concept_expanded_at_idx IF NOT EXISTS
   FOR (c:Concept) ON (c.wikidataExpandedAt)`,
];
