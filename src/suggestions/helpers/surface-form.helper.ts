import { normalizeSurfaceForm } from 'src/common/utils/text-normalize';
import type { ConceptType } from 'src/ontology/constants/concept.types';
import neo4j, {
  type Integer,
  type DateTime as Neo4jDateTime,
  type Node,
  type Relationship,
} from 'neo4j-driver';
import type {
  ConceptData,
  SurfaceFormData,
  UsedSurfaceData,
} from '../types/graph.types';
import type {
  AutocompleteSuggestionDto,
} from '../dto/autocomplete-response.dto';
import type {
  SurfaceRecommendationDto,
  RecommendationReason,
} from '../dto/consistency-response.dto';

export const extractSurfaceForm = (node: Node | null): SurfaceFormData => {
  if (!node) return SurfaceFormDefaults;
  const props = node.properties ?? {};
  return {
    value: asString(props.value),
    normalized: asString(props.normalized),
    conceptName: asString(props.conceptName),
    conceptType: asConceptType(props.conceptType),
    usageCount: asNumber(props.usageCount),
    lastUsedAt: asIsoString(props.lastUsedAt),
  };
};

export const extractConcept = (node: Node | null): ConceptData => {
  if (!node) return ConceptDefaults;
  const props = node.properties ?? {};
  return {
    name: asString(props.name),
    type: asConceptType(props.type),
  };
};

export const extractUsedSurface = (rel: Relationship | null): UsedSurfaceData => {
  if (!rel) return UsedSurfaceDefaults;
  const props = rel.properties ?? {};
  return {
    exists: true,
    usageCount: asNumber(props.usageCount),
    lastUsedAt: asIsoString(props.lastUsedAt),
  };
};

export const excludeMatchingSurface = (
  suggestions: AutocompleteSuggestionDto[],
  normalizedInput: string,
): AutocompleteSuggestionDto[] => {
  if (!normalizedInput) return suggestions;
  return suggestions.filter(
    (item) => normalizeSurfaceInput(item.surface) !== normalizedInput,
  );
};

export const normalizeSurfaceInput = (
  value: string | null | undefined,
): string => normalizeSurfaceForm(value?.trim() ?? '');

export const toSurfaceRecommendationDto = (
  entry: {
    surface: SurfaceFormData;
    usage: UsedSurfaceData;
  },
  reason: RecommendationReason,
  normalizedInput?: string,
): SurfaceRecommendationDto | null => {
  if (!entry.surface.value || !entry.usage.exists) return null;
  const normalizedSurface = normalizeSurfaceInput(entry.surface.value);
  if (normalizedInput && normalizedSurface === normalizedInput) {
    return null;
  }
  return {
    reason,
    surface: entry.surface.value,
    usageCount: entry.usage.usageCount ?? entry.surface.usageCount,
    lastUsedAt: entry.usage.lastUsedAt ?? entry.surface.lastUsedAt,
  };
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asConceptType = (value: unknown): ConceptType | undefined =>
  typeof value === 'string' ? (value as ConceptType) : undefined;

const asNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (neo4j.isInt(value as Integer)) {
    return (value as Integer).toNumber();
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? undefined : numeric;
};

const asIsoString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (isNeo4jDateTime(value)) {
    return neo4jDateTimeToIso(value);
  }
  if (typeof (value as { toString?: () => string })?.toString === 'function') {
    const raw = (value as { toString: () => string }).toString();
    const timestamp = Date.parse(raw);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }
  return null;
};

const isNeo4jDateTime = (value: unknown): value is Neo4jDateTime => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    'year' in candidate &&
    'month' in candidate &&
    'day' in candidate &&
    'hour' in candidate &&
    'minute' in candidate &&
    'second' in candidate &&
    'nanosecond' in candidate
  );
};

const neo4jDateTimeToIso = (value: Neo4jDateTime): string => {
  const year = asNumber(value.year) ?? 0;
  const month = asNumber(value.month) ?? 1;
  const day = asNumber(value.day) ?? 1;
  const hour = asNumber(value.hour) ?? 0;
  const minute = asNumber(value.minute) ?? 0;
  const second = asNumber(value.second) ?? 0;
  const nanosecond = asNumber(value.nanosecond) ?? 0;
  const millisecond = Math.floor((nanosecond ?? 0) / 1_000_000);
  const date = new Date(
    Date.UTC(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0, millisecond),
  );
  return date.toISOString();
};

const SurfaceFormDefaults: SurfaceFormData = {};
const ConceptDefaults: ConceptData = {};
const UsedSurfaceDefaults: UsedSurfaceData = { exists: false };
