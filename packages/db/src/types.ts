/**
 * Pagination / listing options common across repositories.
 * `limit` capped at 200 server-side to avoid runaway queries.
 */
export interface ListOptions {
  limit?: number;
  offset?: number;
}

export const MAX_LIMIT = 200;
export const DEFAULT_LIMIT = 50;

export function clampLimit(limit?: number): number {
  if (!limit || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}
