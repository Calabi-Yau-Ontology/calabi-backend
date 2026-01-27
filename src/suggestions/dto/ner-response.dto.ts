import type { NERLabel } from 'src/ontology/constants/concept.types';

export class NERResponseDto {
  text?: string;
  lang?: 'ko' | 'en' | 'unknown';
  normalized_text_en?: string | null;

  // 핵심: entities 배열
  mentions: Array<{
    surface: string; // 원문 엔티티(없으면 text 사용)
    span: { start: number; end: number };
    ner: { label: NERLabel; confidence?: number };
    canonical: { en?: string; reason?: string | null };
    taxonomy?: {
      oClassId?: string;
      confidence?: number;
      source?: string;
      reason?: string | null;
    };
  }>;

  errors?: Array<Record<string, any>>;
}
