import { ConceptNode } from '../concept.service';

export class ExpansionGuard {
  static shouldExpand(concept: ConceptNode): boolean {
    // expandedAt 있으면 절대 재확장 금지
    if (concept.wikidataExpandedAt) return false;

    // qid 없으면 (search 필요) 확장 대상
    if (!concept.wikidataQid) return true;

    // qid는 있는데 expandedAt이 없으면 “확장 실행 필요”
    return true;
  }
}
