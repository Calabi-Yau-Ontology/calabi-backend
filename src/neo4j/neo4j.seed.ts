/**
 * Calabi Taxonomy Seed (v2)
 *
 * Design constraints (canonical): `CALABI_TAXONOMY_ROLLUP_PLAN.md`
 * - OClass.facet is fixed to exactly 2 values: Activity | Entity
 * - Event-only classification: (:Event)-[:HAS_ACTIVITY]->(:OClass {facet:'Activity'}) (leaf-only)
 * - Concept-only classification: (:Concept)-[:CLASSIFIED_AS]->(:OClass {facet:'Entity'}) (leaf-only)
 * - No "Other/Unknown" forced leaf. If ambiguous, keep unclassified and handle via ops console.
 *
 * Note: This seed is written assuming an empty DB (clean bootstrap).
 * It is still safe to run on every startup (MERGE + SET).
 */

const TAXONOMY_VERSION = 'v2';
const SEED_VERSION = '0.2.0';

export const NEO4J_SEED_STATEMENTS: string[] = [
  // ---- Taxonomy v2: OClass nodes ----
  `
WITH [
  // --------------------
  // Facet roots (visual/grouping only; NOT classification targets)
  // --------------------
  { id: 'ActivityRoot', labelKo: '활동', labelEn: 'Activity', facet: 'Activity', isRoot: false, kind: 'Root', description: 'Activity facet 최상위 루트(분류 타겟 아님; 하위 leaf에만 연결)' },
  { id: 'EntityRoot', labelKo: '엔티티', labelEn: 'Entity', facet: 'Entity', isRoot: false, kind: 'Root', description: 'Entity facet 최상위 루트(분류 타겟 아님; 하위 leaf에만 연결)' },

  // --------------------
  // Activity facet (Event-only; leaf-only targets)
  // --------------------
  { id: 'A_Work', labelKo: '업무', labelEn: 'Work', facet: 'Activity', isRoot: true, kind: 'Category', description: '업무 관련 활동(발생/일정 단위)' },
  { id: 'A_Learning', labelKo: '학습', labelEn: 'Learning', facet: 'Activity', isRoot: true, kind: 'Category', description: '학습/공부/훈련 활동(발생/일정 단위)' },
  { id: 'A_PhysicalExercise', labelKo: '운동', labelEn: 'Physical Exercise', facet: 'Activity', isRoot: true, kind: 'Category', description: '운동/신체 활동(발생/일정 단위)' },
  { id: 'A_HealthCare', labelKo: '건강/의료', labelEn: 'Health Care', facet: 'Activity', isRoot: true, kind: 'Category', description: '진료/치료/검사/회복 등(발생/일정 단위)' },
  { id: 'A_FoodAndDrink', labelKo: '식생활', labelEn: 'Food & Drink', facet: 'Activity', isRoot: true, kind: 'Category', description: '식사/카페/음주 등(발생/일정 단위)' },
  { id: 'A_Social', labelKo: '사교/만남', labelEn: 'Social', facet: 'Activity', isRoot: true, kind: 'Category', description: '사람들과의 만남/교류/네트워킹(발생/일정 단위; 참석자 확정 아님)' },
  { id: 'A_Leisure', labelKo: '여가/오락', labelEn: 'Leisure', facet: 'Activity', isRoot: true, kind: 'Category', description: '여가/취미/오락(발생/일정 단위)' },
  { id: 'A_HomeLife', labelKo: '가정/생활', labelEn: 'Home Life', facet: 'Activity', isRoot: true, kind: 'Category', description: '가사/가정/일상 루틴(발생/일정 단위)' },
  { id: 'A_TravelMove', labelKo: '이동/여행', labelEn: 'Travel & Move', facet: 'Activity', isRoot: true, kind: 'Category', description: '이동/여행/출장(발생/일정 단위)' },
  { id: 'A_Errands', labelKo: '용무/행정', labelEn: 'Errands', facet: 'Activity', isRoot: true, kind: 'Category', description: '은행/관공서/구매/잡무 등(발생/일정 단위)' },
  { id: 'A_Rest', labelKo: '휴식/회복', labelEn: 'Rest', facet: 'Activity', isRoot: true, kind: 'Category', description: '휴식/회복/재충전(발생/일정 단위)' },

  // --------------------
  // Entity facet (Concept-only; leaf-only targets)
  // --------------------
  { id: 'E_Person', labelKo: '인물', labelEn: 'Person', facet: 'Entity', isRoot: true, kind: 'Category', description: '사람/인물 멘션(Concept) 분류용 지식 영역' },
  { id: 'E_Place', labelKo: '장소', labelEn: 'Place', facet: 'Entity', isRoot: true, kind: 'Category', description: '장소/공간 멘션(Concept) 분류용 지식 영역' },
  { id: 'E_Food', labelKo: '음식', labelEn: 'Food', facet: 'Entity', isRoot: true, kind: 'Category', description: '음식/식당/요리 멘션(Concept) 분류용 지식 영역' },
  { id: 'E_Media', labelKo: '미디어', labelEn: 'Media', facet: 'Entity', isRoot: true, kind: 'Category', description: '영화/TV/책/콘텐츠 멘션(Concept) 분류용 지식 영역' },
  { id: 'E_Organization', labelKo: '조직', labelEn: 'Organization', facet: 'Entity', isRoot: true, kind: 'Category', description: '회사/기관/단체 멘션(Concept) 분류용 지식 영역' },
  { id: 'E_Animal', labelKo: '동물', labelEn: 'Animal', facet: 'Entity', isRoot: true, kind: 'Category', description: '동물 멘션(Concept) 분류용 지식 영역' },
  { id: 'E_Project', labelKo: '프로젝트', labelEn: 'Project', facet: 'Entity', isRoot: true, kind: 'Category', description: '프로젝트/업무 단위 멘션(Concept) 분류용 지식 영역' },

  // Topic domains: internal root + domain leaves (지식 영역급; 인스턴스급 금지)
  { id: 'E_TopicDomain', labelKo: '주제(도메인)', labelEn: 'Topic Domain', facet: 'Entity', isRoot: true, kind: 'Category', description: '주제/지식 영역 루트. 특정 멘션(예: 배드민턴/클라이밍/AI/세금)은 하위 도메인 leaf로 분류된다.' },
  { id: 'E_Topic_Sport', labelKo: '스포츠', labelEn: 'Sport', facet: 'Entity', isRoot: false, kind: 'Category', description: '스포츠/운동 종목 관련 멘션의 지식 영역(예: 배드민턴, 축구, 클라이밍 등)' },
  { id: 'E_Topic_Technology', labelKo: '기술/컴퓨팅', labelEn: 'Technology', facet: 'Entity', isRoot: false, kind: 'Category', description: '소프트웨어/컴퓨팅/기술 관련 멘션의 지식 영역(예: AI, 데이터베이스 등)' },
  { id: 'E_Topic_Business', labelKo: '비즈니스/산업', labelEn: 'Business', facet: 'Entity', isRoot: false, kind: 'Category', description: '비즈니스/산업/경영 관련 멘션의 지식 영역' },
  { id: 'E_Topic_Finance', labelKo: '금융/재무', labelEn: 'Finance', facet: 'Entity', isRoot: false, kind: 'Category', description: '금융/재무/투자/세무 관련 멘션의 지식 영역(예: 세금, 예산 등)' },
  { id: 'E_Topic_Health', labelKo: '건강/의학', labelEn: 'Health', facet: 'Entity', isRoot: false, kind: 'Category', description: '건강/의학/웰빙 관련 멘션의 지식 영역' },
  { id: 'E_Topic_Science', labelKo: '과학/연구', labelEn: 'Science', facet: 'Entity', isRoot: false, kind: 'Category', description: '과학/연구/학문 관련 멘션의 지식 영역' },
  { id: 'E_Topic_ArtsCulture', labelKo: '예술/문화', labelEn: 'Arts & Culture', facet: 'Entity', isRoot: false, kind: 'Category', description: '예술/문화 관련 멘션의 지식 영역' },
  { id: 'E_Topic_Entertainment', labelKo: '엔터테인먼트', labelEn: 'Entertainment', facet: 'Entity', isRoot: false, kind: 'Category', description: '대중문화/콘텐츠 소비 관련 멘션의 지식 영역' },
  { id: 'E_Topic_PoliticsSociety', labelKo: '정치/사회', labelEn: 'Politics & Society', facet: 'Entity', isRoot: false, kind: 'Category', description: '정치/사회 이슈 관련 멘션의 지식 영역' },
  { id: 'E_Topic_Education', labelKo: '교육', labelEn: 'Education', facet: 'Entity', isRoot: false, kind: 'Category', description: '교육/학습 제도/교육 활동 관련 멘션의 지식 영역' },
  { id: 'E_Topic_Lifestyle', labelKo: '라이프스타일', labelEn: 'Lifestyle', facet: 'Entity', isRoot: false, kind: 'Category', description: '일상/취향/생활양식 관련 멘션의 지식 영역' },
  { id: 'E_Topic_Productivity', labelKo: '생산성/자기관리', labelEn: 'Productivity', facet: 'Entity', isRoot: false, kind: 'Category', description: '생산성/자기관리/습관 관련 멘션의 지식 영역' },
  { id: 'E_Topic_NatureEnvironment', labelKo: '자연/환경', labelEn: 'Nature & Environment', facet: 'Entity', isRoot: false, kind: 'Category', description: '자연/환경/날씨/지리 일반 관련 멘션의 지식 영역' },
  { id: 'E_Topic_ReligionSpirituality', labelKo: '종교/영성', labelEn: 'Religion & Spirituality', facet: 'Entity', isRoot: false, kind: 'Category', description: '종교/영성/명상 등 관련 멘션의 지식 영역' },
  { id: 'E_Topic_LawGovernment', labelKo: '법/행정', labelEn: 'Law & Government', facet: 'Entity', isRoot: false, kind: 'Category', description: '법/행정/정책/제도 관련 멘션의 지식 영역' }
] AS classes
UNWIND classes AS cls
MERGE (c:OClass { id: cls.id })
ON CREATE SET
  c.labelKo = cls.labelKo,
  c.labelEn = cls.labelEn,
  c.facet = cls.facet,
  c.kind = cls.kind,
  c.isRoot = cls.isRoot,
  c.description = cls.description,
  c.seedVersion = '${SEED_VERSION}',
  c.taxonomyVersion = '${TAXONOMY_VERSION}',
  c.createdAt = datetime()
SET
  c.labelKo = cls.labelKo,
  c.labelEn = cls.labelEn,
  c.facet = cls.facet,
  c.kind = cls.kind,
  c.isRoot = cls.isRoot,
  c.description = cls.description,
  c.seedVersion = '${SEED_VERSION}',
  c.taxonomyVersion = '${TAXONOMY_VERSION}',
  c.updatedAt = datetime()
RETURN count(c) AS ensuredOClassCount
  `,

  // ---- Taxonomy v2: subclass edges ----
  `
WITH [
  // Facet roots
  { child: 'A_Work', parent: 'ActivityRoot' },
  { child: 'A_Learning', parent: 'ActivityRoot' },
  { child: 'A_PhysicalExercise', parent: 'ActivityRoot' },
  { child: 'A_HealthCare', parent: 'ActivityRoot' },
  { child: 'A_FoodAndDrink', parent: 'ActivityRoot' },
  { child: 'A_Social', parent: 'ActivityRoot' },
  { child: 'A_Leisure', parent: 'ActivityRoot' },
  { child: 'A_HomeLife', parent: 'ActivityRoot' },
  { child: 'A_TravelMove', parent: 'ActivityRoot' },
  { child: 'A_Errands', parent: 'ActivityRoot' },
  { child: 'A_Rest', parent: 'ActivityRoot' },

  { child: 'E_Person', parent: 'EntityRoot' },
  { child: 'E_Place', parent: 'EntityRoot' },
  { child: 'E_Food', parent: 'EntityRoot' },
  { child: 'E_Media', parent: 'EntityRoot' },
  { child: 'E_Organization', parent: 'EntityRoot' },
  { child: 'E_Animal', parent: 'EntityRoot' },
  { child: 'E_Project', parent: 'EntityRoot' },
  { child: 'E_TopicDomain', parent: 'EntityRoot' },

  // Topic domains
  { child: 'E_Topic_Sport', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Technology', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Business', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Finance', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Health', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Science', parent: 'E_TopicDomain' },
  { child: 'E_Topic_ArtsCulture', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Entertainment', parent: 'E_TopicDomain' },
  { child: 'E_Topic_PoliticsSociety', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Education', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Lifestyle', parent: 'E_TopicDomain' },
  { child: 'E_Topic_Productivity', parent: 'E_TopicDomain' },
  { child: 'E_Topic_NatureEnvironment', parent: 'E_TopicDomain' },
  { child: 'E_Topic_ReligionSpirituality', parent: 'E_TopicDomain' },
  { child: 'E_Topic_LawGovernment', parent: 'E_TopicDomain' }
] AS edges
UNWIND edges AS e
MATCH (child:OClass { id: e.child })
MATCH (parent:OClass { id: e.parent })
MERGE (child)-[r:OSUBCLASS_OF]->(parent)
ON CREATE SET r.createdAt = datetime()
SET r.updatedAt = datetime()
RETURN count(r) AS ensuredSubclassEdgesCount
  `,
];
