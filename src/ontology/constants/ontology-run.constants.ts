export const ONTOLOGY_RUN_KINDS = [
  'cq_propose',
  'batch_classify',
  'auto_classify',
] as const;
export type OntologyRunKind = (typeof ONTOLOGY_RUN_KINDS)[number];

export const ONTOLOGY_RUN_STATUSES = [
  'proposed',
  'confirmed',
  'apply_requested',
  'applied',
  'failed',
] as const;
export type OntologyRunStatus = (typeof ONTOLOGY_RUN_STATUSES)[number];
