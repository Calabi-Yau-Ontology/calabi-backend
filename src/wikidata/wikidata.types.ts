export type WikidataSearchItem = {
  id: string; // QID
  label: string;
  description?: string;
};

export type WikidataNeighbor = {
  neighborQid: string;
  neighborLabel: string;
  rel: 'INSTANCE_OF' | 'SUBCLASS_OF' | 'HAS_PART' | 'HAS_GOAL';
};

export type WikidataEntityLite = {
  qid: string;
  labelEn: string;
  descriptionEn?: string | null;
};

export const PID_TO_REL: Record<string, WikidataNeighbor['rel']> = {
  P31: 'INSTANCE_OF',
  P279: 'SUBCLASS_OF',
  P527: 'HAS_PART',
  P3712: 'HAS_GOAL',
};
