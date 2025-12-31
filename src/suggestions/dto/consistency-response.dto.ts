import { ConceptType } from 'src/ontology/constants/concept.types';

export type RecommendationReason = 'most_recent' | 'most_frequent';

export class SurfaceRecommendationDto {
  reason!: RecommendationReason;
  surface!: string;
  usageCount?: number;
  lastUsedAt?: string | null;
}

export class ConsistencyRecommendationDto {
  canonicalName!: string;
  conceptType?: ConceptType;
  inputSurface?: string | null;
  mostRecent?: SurfaceRecommendationDto | null;
  mostFrequent?: SurfaceRecommendationDto | null;
}

export class ConsistencyCheckResponseDto {
  cacheToken!: string;
  results!: ConsistencyRecommendationDto[];
  errors?: Array<Record<string, any>>;
}
