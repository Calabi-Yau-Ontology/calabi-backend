export const NEO4J_SEED_STATEMENTS: string[] = [
  // ---- Meta ontology seed (taxonomy MVP) ----
  // Safe to run on every startup (MERGE + ON CREATE, plus guarded seed updates).
  `
WITH [
  // Roots (facet: Activity)
  { id: 'Work', labelKo: '업무', labelEn: 'Work', facet: 'Activity', isRoot: true, kind: 'Category', description: '업무 관련 활동' },
  { id: 'Learning', labelKo: '학습', labelEn: 'Learning', facet: 'Activity', isRoot: true, kind: 'Category', description: '학습/공부/훈련' },
  { id: 'PhysicalActivity', labelKo: '운동', labelEn: 'Physical Activity', facet: 'Activity', isRoot: true, kind: 'Category', description: '신체 활동/운동' },
  { id: 'HealthCare', labelKo: '의료/케어', labelEn: 'Health Care', facet: 'Activity', isRoot: true, kind: 'Category', description: '병원/치료/회복' },
  { id: 'HomeLife', labelKo: '가정/생활', labelEn: 'Home Life', facet: 'Activity', isRoot: true, kind: 'Category', description: '가정/생활 루틴' },
  { id: 'Social', labelKo: '사교', labelEn: 'Social', facet: 'Activity', isRoot: true, kind: 'Category', description: '사교/대인 관계 활동' },
  { id: 'Leisure', labelKo: '여가', labelEn: 'Leisure', facet: 'Activity', isRoot: true, kind: 'Category', description: '취미/여가' },
  { id: 'Rest', labelKo: '휴식', labelEn: 'Rest', facet: 'Activity', isRoot: true, kind: 'Category', description: '휴식/회복' },
  { id: 'TravelMove', labelKo: '이동/여행', labelEn: 'Travel & Move', facet: 'Activity', isRoot: true, kind: 'Category', description: '이동/여행' },
  { id: 'Errands', labelKo: '용무', labelEn: 'Errands', facet: 'Activity', isRoot: true, kind: 'Category', description: '심부름/행정/잡무' },
  { id: 'FoodActivity', labelKo: '식생활', labelEn: 'Food Activity', facet: 'Activity', isRoot: true, kind: 'Category', description: '식사/카페/음주 등 식생활 활동' },

  // Children (Work)
  { id: 'Meeting', labelKo: '미팅', labelEn: 'Meeting', facet: 'Activity', isRoot: false, kind: 'Category', description: '회의/미팅/통화(타이틀 기반)' },
  { id: 'DeepWork', labelKo: '집중 업무', labelEn: 'Deep Work', facet: 'Activity', isRoot: false, kind: 'Category', description: '집중 작업/개발/설계' },
  { id: 'WritingDocs', labelKo: '문서/글쓰기', labelEn: 'Writing & Docs', facet: 'Activity', isRoot: false, kind: 'Category', description: '문서 작성/정리/글쓰기' },
  { id: 'AdminWork', labelKo: '업무 잡무', labelEn: 'Administrative Work', facet: 'Activity', isRoot: false, kind: 'Category', description: '메일/정산/보고 등 업무성 잡무' },

  // Children (Learning)
  { id: 'StudySession', labelKo: '자습/공부', labelEn: 'Study Session', facet: 'Activity', isRoot: false, kind: 'Category', description: '혼자 공부/훈련' },
  { id: 'CourseClass', labelKo: '수업/강의', labelEn: 'Course / Class', facet: 'Activity', isRoot: false, kind: 'Category', description: '수업/강의/세미나' },
  { id: 'ReadingLearning', labelKo: '학습 독서', labelEn: 'Reading (Learning)', facet: 'Activity', isRoot: false, kind: 'Category', description: '학습 목적의 독서/리서치' },

  // Children (PhysicalActivity)
  { id: 'StrengthTraining', labelKo: '근력 운동', labelEn: 'Strength Training', facet: 'Activity', isRoot: false, kind: 'Category', description: '헬스/웨이트/근력' },
  { id: 'Cardio', labelKo: '유산소', labelEn: 'Cardio', facet: 'Activity', isRoot: false, kind: 'Category', description: '러닝/사이클/유산소' },
  { id: 'Sport', labelKo: '스포츠', labelEn: 'Sport', facet: 'Activity', isRoot: false, kind: 'Category', description: '구기/경기/스포츠' },
  { id: 'OutdoorActivity', labelKo: '아웃도어', labelEn: 'Outdoor Activity', facet: 'Activity', isRoot: false, kind: 'Category', description: '등산/트레킹/캠핑 등 야외 활동' },

  // Children (HealthCare)
  { id: 'ClinicVisit', labelKo: '병원/진료', labelEn: 'Clinic Visit', facet: 'Activity', isRoot: false, kind: 'Category', description: '병원/진료/검사' },
  { id: 'TherapyRecovery', labelKo: '치료/회복', labelEn: 'Therapy & Recovery', facet: 'Activity', isRoot: false, kind: 'Category', description: '치료/재활/회복' },

  // Children (HomeLife)
  { id: 'Housework', labelKo: '집안일', labelEn: 'Housework', facet: 'Activity', isRoot: false, kind: 'Category', description: '청소/정리/세탁 등' },
  { id: 'FamilyTime', labelKo: '가족 시간', labelEn: 'Family Time', facet: 'Activity', isRoot: false, kind: 'Category', description: '가족 관련으로 기록된 일정(타이틀 기반)' },

  // Children (Social)
  { id: 'Hangout', labelKo: '모임/만남', labelEn: 'Hangout', facet: 'Activity', isRoot: false, kind: 'Category', description: '친구/지인 만남(타이틀 기반)' },
  { id: 'Networking', labelKo: '네트워킹', labelEn: 'Networking', facet: 'Activity', isRoot: false, kind: 'Category', description: '업무/커뮤니티 네트워킹(타이틀 기반)' },

  // Children (Leisure)
  { id: 'Hobby', labelKo: '취미', labelEn: 'Hobby', facet: 'Activity', isRoot: false, kind: 'Category', description: '취미 활동' },
  { id: 'Gaming', labelKo: '게임', labelEn: 'Gaming', facet: 'Activity', isRoot: false, kind: 'Category', description: '게임' },

  // Children (Rest)
  { id: 'SleepRest', labelKo: '수면/휴식', labelEn: 'Sleep / Rest', facet: 'Activity', isRoot: false, kind: 'Category', description: '수면/휴식' },
  { id: 'Break', labelKo: '휴게/브레이크', labelEn: 'Break', facet: 'Activity', isRoot: false, kind: 'Category', description: '짧은 휴게/브레이크' },

  // Children (TravelMove)
  { id: 'Commute', labelKo: '통근/이동', labelEn: 'Commute', facet: 'Activity', isRoot: false, kind: 'Category', description: '출퇴근/이동' },
  { id: 'Trip', labelKo: '여행', labelEn: 'Trip', facet: 'Activity', isRoot: false, kind: 'Category', description: '여행/출장 등' },

  // Children (Errands)
  { id: 'Shopping', labelKo: '쇼핑', labelEn: 'Shopping', facet: 'Activity', isRoot: false, kind: 'Category', description: '쇼핑/구매' },
  { id: 'BankingGov', labelKo: '은행/관공서', labelEn: 'Banking / Government', facet: 'Activity', isRoot: false, kind: 'Category', description: '은행/관공서/민원' },

  // Children (FoodActivity)
  { id: 'DiningOut', labelKo: '식사', labelEn: 'Dining Out', facet: 'Activity', isRoot: false, kind: 'Category', description: '점심/저녁/식사' },
  { id: 'CafeDessert', labelKo: '카페/디저트', labelEn: 'Cafe & Dessert', facet: 'Activity', isRoot: false, kind: 'Category', description: '카페/디저트' },
  { id: 'Drinking', labelKo: '음주', labelEn: 'Drinking', facet: 'Activity', isRoot: false, kind: 'Category', description: '술/바/음주' }
] AS classes
UNWIND classes AS cls
MERGE (c:OClass {id: cls.id})
ON CREATE SET
  c.labelKo = cls.labelKo,
  c.labelEn = cls.labelEn,
  c.facet = cls.facet,
  c.kind = cls.kind,
  c.isRoot = cls.isRoot,
  c.description = cls.description,
  c.status = 'active',
  c.seedVersion = '0.1.1',
  c.createdAt = datetime()
RETURN count(c) AS ensuredOClassCount
  `,

  `
// Seed description hotfixes (guarded):
// - Only update nodes created by older seeds (seedVersion=0.1) and only when description is missing or matches the previous seed text.
WITH [
  { id: 'OutdoorActivity', prev: '등산/클라이밍 등 야외 활동', next: '등산/트레킹/캠핑 등 야외 활동' },
  { id: 'FamilyTime', prev: '가족 관련 일정', next: '가족 관련으로 기록된 일정(타이틀 기반)' },
  { id: 'Networking', prev: '업무/커뮤니티 네트워킹', next: '업무/커뮤니티 네트워킹(타이틀 기반)' },
  { id: 'Meeting', prev: '회의/미팅/통화', next: '회의/미팅/통화(타이틀 기반)' },
  { id: 'Hangout', prev: '친구/지인 만남', next: '친구/지인 만남(타이틀 기반)' }
] AS fixes
UNWIND fixes AS f
MATCH (c:OClass {id: f.id})
WHERE c.seedVersion = '0.1'
  AND (c.description IS NULL OR c.description = f.prev)
SET c.description = f.next,
    c.seedVersion = '0.1.1',
    c.updatedAt = datetime()
RETURN count(c) AS updatedOClassCount
  `,

  `
WITH [
  { child: 'Meeting', parent: 'Work' },
  { child: 'DeepWork', parent: 'Work' },
  { child: 'WritingDocs', parent: 'Work' },
  { child: 'AdminWork', parent: 'Work' },

  { child: 'StudySession', parent: 'Learning' },
  { child: 'CourseClass', parent: 'Learning' },
  { child: 'ReadingLearning', parent: 'Learning' },

  { child: 'StrengthTraining', parent: 'PhysicalActivity' },
  { child: 'Cardio', parent: 'PhysicalActivity' },
  { child: 'Sport', parent: 'PhysicalActivity' },
  { child: 'OutdoorActivity', parent: 'PhysicalActivity' },

  { child: 'ClinicVisit', parent: 'HealthCare' },
  { child: 'TherapyRecovery', parent: 'HealthCare' },

  { child: 'Housework', parent: 'HomeLife' },
  { child: 'FamilyTime', parent: 'HomeLife' },

  { child: 'Hangout', parent: 'Social' },
  { child: 'Networking', parent: 'Social' },

  { child: 'Hobby', parent: 'Leisure' },
  { child: 'Gaming', parent: 'Leisure' },

  { child: 'SleepRest', parent: 'Rest' },
  { child: 'Break', parent: 'Rest' },

  { child: 'Commute', parent: 'TravelMove' },
  { child: 'Trip', parent: 'TravelMove' },

  { child: 'Shopping', parent: 'Errands' },
  { child: 'BankingGov', parent: 'Errands' },

  { child: 'DiningOut', parent: 'FoodActivity' },
  { child: 'CafeDessert', parent: 'FoodActivity' },
  { child: 'Drinking', parent: 'FoodActivity' }
] AS edges
UNWIND edges AS e
MATCH (child:OClass {id: e.child})
MATCH (parent:OClass {id: e.parent})
MERGE (child)-[:OSUBCLASS_OF]->(parent)
RETURN count(*) AS ensuredSubclassEdgesCount
  `,
];
