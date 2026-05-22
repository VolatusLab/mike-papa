/**
 * Canonical warrant status. Whitespace + case + accent insensitive matching
 * against the raw `descricaoStatus` returned by BNMP. Unknown values map to OUTRO
 * so the worker doesn't crash on new statuses — log + add to this map.
 */
export type CanonicalStatus =
  | 'PENDENTE'
  | 'CUMPRIDO'
  | 'REVOGADO'
  | 'BAIXADO'
  | 'SUSPENSO'
  | 'OUTRO';

const RAW_TO_CANONICAL: ReadonlyArray<readonly [RegExp, CanonicalStatus]> = [
  [/pendente.*cumprimento/i, 'PENDENTE'],
  [/cumprid[oa]/i, 'CUMPRIDO'],
  [/revogad[oa]/i, 'REVOGADO'],
  [/baixad[oa]/i, 'BAIXADO'],
  [/suspens[oa]/i, 'SUSPENSO'],
];

export function canonicalizeStatus(raw: string): CanonicalStatus {
  const normalized = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  for (const [pattern, canonical] of RAW_TO_CANONICAL) {
    if (pattern.test(normalized)) return canonical;
  }
  return 'OUTRO';
}
