/**
 * Parse `YYYY-MM-DD` (BNMP ISO date — no time) to a UTC Date pinned at midnight.
 * Tolerant: returns null on invalid input.
 */
export function parseIsoDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  // Anchored at UTC midnight to avoid tz drift when stored as @db.Date.
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Inverse of parseIsoDate. */
export function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
