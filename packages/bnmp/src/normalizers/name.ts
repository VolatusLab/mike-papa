/**
 * Canonicalize a person/órgão name for storage + dedup display.
 * - trims, collapses internal whitespace
 * - removes diacritics for comparison key (NOT for display)
 */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, ' ');
}

/** Removes diacritics; useful for comparison keys / search. */
export function deaccent(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Comparison key: trimmed, collapsed, lowercased, deaccented. */
export function nameKey(raw: string | null | undefined): string {
  return deaccent(normalizeName(raw).toLowerCase());
}
