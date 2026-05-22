import { describe, expect, it } from 'vitest';
import {
  canonicalize,
  canonicalizeStatus,
  deaccent,
  formatIsoDate,
  nameKey,
  normalizeName,
  parseIsoDate,
  snapshotHash,
} from '../normalizers/index.js';

describe('normalizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeName('  Roberto   Rodrigues  ')).toBe('Roberto Rodrigues');
  });
  it('returns empty on null/undefined', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('deaccent + nameKey', () => {
  it('removes diacritics', () => {
    expect(deaccent('São João do Araguaía')).toBe('Sao Joao do Araguaia');
  });
  it('produces a stable comparison key', () => {
    expect(nameKey('  ROBÉRTO  RODRIGUES  ')).toBe('roberto rodrigues');
  });
});

describe('parseIsoDate', () => {
  it('parses YYYY-MM-DD at UTC midnight', () => {
    const d = parseIsoDate('2025-11-25');
    expect(d?.toISOString()).toBe('2025-11-25T00:00:00.000Z');
  });
  it('rejects non-ISO formats', () => {
    expect(parseIsoDate('25/11/2025')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
  });
});

describe('formatIsoDate', () => {
  it('inverts parseIsoDate', () => {
    const d = parseIsoDate('2025-11-25');
    expect(d).not.toBeNull();
    if (d) expect(formatIsoDate(d)).toBe('2025-11-25');
  });
});

describe('canonicalizeStatus', () => {
  it('matches common BNMP statuses regardless of accents/case', () => {
    expect(canonicalizeStatus('Pendente de Cumprimento')).toBe('PENDENTE');
    expect(canonicalizeStatus('CUMPRIDO')).toBe('CUMPRIDO');
    expect(canonicalizeStatus('Revogado')).toBe('REVOGADO');
    expect(canonicalizeStatus('Baixado')).toBe('BAIXADO');
    expect(canonicalizeStatus('Suspenso')).toBe('SUSPENSO');
  });
  it('falls back to OUTRO on unknown', () => {
    expect(canonicalizeStatus('Algo totalmente novo')).toBe('OUTRO');
  });
});

describe('canonicalize + snapshotHash', () => {
  it('produces same string regardless of key order', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });
  it('preserves array order', () => {
    expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
  });
  it('hashes are deterministic and key-order-insensitive', () => {
    const a = snapshotHash({ x: 1, y: { z: [1, 2], k: 'a' } });
    const b = snapshotHash({ y: { k: 'a', z: [1, 2] }, x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it('differs when any value changes', () => {
    expect(snapshotHash({ s: 'Pendente' })).not.toBe(snapshotHash({ s: 'Cumprido' }));
  });
});
