export const ALLOWED_NER_LABELS = new Set([
  'Activity',
  'Location',
  'Person',
  'Project',
  'Topic',
] as const);

export type ConceptType = 'Activity' | 'Location' | 'Person' | 'Project' | 'Topic';
