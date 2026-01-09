import { createHash } from 'crypto';

export const EVENT_NER_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours
export const EVENT_NER_CACHE_TIMEOUT_MS = 10_000;
export const EVENT_NER_CACHE_POLL_INTERVAL_MS = 500;

export function normalizeEventTitle(title?: string | null): string {
  return title?.trim() ?? '';
}

export function buildEventNerCacheKey(eventId: string, title: string): string {
  const normalized = title.trim().toLowerCase();
  const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 16);
  return `event:${eventId}:${hash}`;
}
