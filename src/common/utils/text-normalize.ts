/**
 * Normalize a surface form for comparison/search.
 * - Trim whitespace
 * - Collapse multiple spaces into single space
 * - Lowercase the string (covers Latin inputs)
 */
export function normalizeSurfaceForm(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize().trim().replace(/\s+/g, ' ').toLowerCase();
}
