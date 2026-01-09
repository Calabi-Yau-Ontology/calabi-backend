export const ONTOLOGY_QUEUE_NAME = 'ontology-queue';
export const PROCESS_EVENT_ONTOLOGY_JOB = 'process-event-ontology';

export type OntologyJobMode = 'create' | 'update';

export interface OntologyQueueJob {
  userId: string;
  eventId: string;
  mode: OntologyJobMode;
  cacheToken?: string | null;
}
