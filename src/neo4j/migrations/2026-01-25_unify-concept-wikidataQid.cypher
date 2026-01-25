// 2026-01-25
// 목적: Concept 노드의 Wikidata QID 필드를 `qid` → `wikidataQid`로 단일화
//
// 실행 위치:
// - Neo4j Browser 또는 cypher-shell
// - 운영/개발 DB 모두 "1회만" 실행
//
// 주의:
// - 아래 0)에서 충돌(conflict)이 발견되면, 1)~2) 적용 전에 먼저 확인/정리 권장

// 0) 사전 점검: qid와 wikidataQid가 모두 존재하지만 값이 다른 케이스
MATCH (c:Concept)
WHERE c.qid IS NOT NULL
  AND c.wikidataQid IS NOT NULL
  AND c.qid <> c.wikidataQid
RETURN c.name AS name, c.qid AS qid, c.wikidataQid AS wikidataQid
LIMIT 50;

// 1) 마이그레이션: wikidataQid가 비어있으면 qid를 복사
MATCH (c:Concept)
WHERE c.qid IS NOT NULL
  AND (c.wikidataQid IS NULL OR trim(toString(c.wikidataQid)) = "")
SET c.wikidataQid = c.qid
RETURN count(c) AS migratedCount;

// 1b) 사후 점검: 동일 wikidataQid 중복 노드가 있는지 확인
// - 과거에 (name, qid)로 MERGE 하면서 같은 qid가 중복 생성되었을 수 있음
MATCH (c:Concept)
WHERE c.wikidataQid IS NOT NULL AND trim(toString(c.wikidataQid)) <> ""
WITH c.wikidataQid AS wikidataQid, collect(c) AS nodes, count(*) AS cnt
WHERE cnt > 1
RETURN wikidataQid, cnt, [n IN nodes | n.name][0..10] AS sampleNames
ORDER BY cnt DESC
LIMIT 50;

// 2) 정리: legacy `qid` 프로퍼티 제거
// - 충돌 케이스(qid != wikidataQid)는 정보를 잃지 않도록 남겨둔다.
MATCH (c:Concept)
WHERE c.qid IS NOT NULL
  AND (c.wikidataQid IS NULL OR c.wikidataQid = c.qid)
REMOVE c.qid
RETURN count(c) AS removedLegacyQidCount;
