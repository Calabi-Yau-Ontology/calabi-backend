import type { ConceptType } from 'src/ontology/constants/concept.types';
import type { Node, Relationship } from 'neo4j-driver';

export type SurfaceFormData = {
  value?: string;
  normalized?: string;
  conceptName?: string;
  conceptType?: ConceptType;
  usageCount?: number;
  lastUsedAt?: string | null;
};

export type ConceptData = {
  name?: string;
  type?: ConceptType;
};

export type UsedSurfaceData = {
  exists: boolean;
  usageCount?: number;
  lastUsedAt?: string | null;
};

export type SurfaceRecommendationRowEntry = {
  node?: Node | null;
  rel?: Relationship | null;
} | null;

export type ConsistencyRecommendationRow = {
  canonicalName: string;
  conceptType?: ConceptType;
  inputSurface?: string | null;
  inputSpan?: { start: number; end: number } | null;
  mostFrequent?: SurfaceRecommendationRowEntry;
  mostRecent?: SurfaceRecommendationRowEntry;
};

export type CanonicalMention = {
  canonicalName: string;
  surface?: string | null;
  span?: { start: number; end: number } | null;
};
