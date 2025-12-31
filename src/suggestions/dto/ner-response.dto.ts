// export class NerEntityDto {
//   text!: string;
//   label!: string;
//   start!: number;
//   end!: number;
// }

// export class NerResponseDto {
//   entities!: NerEntityDto[];
// }

// 25.12.21 기준 NER 라벨 목록
export type NERLabel =
  | 'Activity'
  | 'Location'
  | 'Person'
  | 'Project'
  | 'Topic'
  | 'Organization'
  | 'Food'
  | 'Date'
  | 'None';

export class NerResponseDto {
  text?: string;
  lang?: 'ko' | 'en' | 'unknown';
  normalized_text_en?: string | null;

  // 핵심: entities 배열
  mentions: Array<{
    surface: string; // 원문 엔티티(없으면 text 사용)
    span: { start: number; end: number };
    ner: { label: NERLabel; confidence?: number };
    canonical: { en?: string; reason?: string | null };
  }>;

  errors?: Array<Record<string, any>>;
}
