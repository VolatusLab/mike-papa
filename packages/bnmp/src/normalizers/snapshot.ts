import { createHash } from 'node:crypto';

/**
 * Recursively stable-stringify a value: object keys sorted, arrays preserve order,
 * primitives JSON-encoded. Used as the canonical form for change-detection hashing —
 * two semantically equal payloads MUST produce the same hash regardless of key order.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${parts.join(',')}}`;
}

/** SHA-256 hex of the canonical form. Stored as Warrant.snapshotHash. */
export function snapshotHash(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}
