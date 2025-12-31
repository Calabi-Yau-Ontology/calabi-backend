import { ConceptType } from 'src/ontology/constants/concept.types';

export class AutocompleteSuggestionDto {
  surface!: string;
  conceptName?: string;
  conceptType?: ConceptType;
  lastUsedAt?: string | null;
  usageCount?: number;
}

export class AutocompleteResponseDto {
  suggestions!: AutocompleteSuggestionDto[];
}
