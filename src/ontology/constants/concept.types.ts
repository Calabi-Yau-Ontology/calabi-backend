// Labels used in ML Server (25.12.29 기준)
export const NER_LABELS = [
  'Activity',
  'Location',
  'Person',
  'Project',
  'Topic',
  'Organization',
  'Food',
  'Movie',
  'TVShow',
  'Animal',
  'Date',
  'None',
] as const;
export type NERLabel = (typeof NER_LABELS)[number];

const LABEL_TO_CONCEPT_TYPE = {
  Activity: 'Activity',
  Location: 'Location',
  Person: 'Person',
  Project: 'Project',
  Topic: 'Topic',
  Organization: 'Organization',
  Food: 'Food',
  Movie: 'Media',
  TVShow: 'Media',
  Animal: 'Animal',
} as const;

type LabelToConceptTypeMap = typeof LABEL_TO_CONCEPT_TYPE;
export type AllowedNERLabel = keyof LabelToConceptTypeMap;
export type ConceptType = LabelToConceptTypeMap[AllowedNERLabel];

export const NER_TO_CONCEPT_TYPE: Record<AllowedNERLabel, ConceptType> =
  LABEL_TO_CONCEPT_TYPE;

const allowedLabelList = Object.keys(
  LABEL_TO_CONCEPT_TYPE,
) as AllowedNERLabel[];
export const ALLOWED_NER_LABELS = new Set<AllowedNERLabel>(allowedLabelList);
export const isAllowedNERLabel = (label: unknown): label is AllowedNERLabel => {
  if (typeof label !== 'string') return false;
  return ALLOWED_NER_LABELS.has(label as AllowedNERLabel);
};

const conceptTypeList = Array.from(
  new Set(Object.values(LABEL_TO_CONCEPT_TYPE)),
) as ConceptType[];
export const CONCEPT_TYPE_LABELS = conceptTypeList;
