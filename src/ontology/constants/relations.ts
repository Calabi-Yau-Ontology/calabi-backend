export const RELATIONS = {
  OWNS_EVENT: 'OWNS_EVENT',
  MENTIONS: 'MENTIONS',
  RELATED_TO: 'RELATED_TO',
  SURFACE_OF: 'SURFACE_OF',

  INSTANCE_OF: 'INSTANCE_OF',
  SUBCLASS_OF: 'SUBCLASS_OF',
  HAS_PART: 'HAS_PART',
  HAS_GOAL: 'HAS_GOAL',
} as const;

export type RelationKey = keyof typeof RELATIONS;
export type RelationValue = (typeof RELATIONS)[RelationKey];
