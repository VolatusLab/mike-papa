import { describe, expect, it } from 'vitest';
import { generateFingerprint, isValidFingerprint } from '../session/fingerprint.js';

describe('generateFingerprint', () => {
  it('produces a 32-char hex string', () => {
    const fp = generateFingerprint();
    expect(fp).toMatch(/^[0-9a-f]{32}$/);
    expect(isValidFingerprint(fp)).toBe(true);
  });
  it('is reasonably unique across calls', () => {
    const set = new Set(Array.from({ length: 200 }, () => generateFingerprint()));
    expect(set.size).toBe(200);
  });
});

describe('isValidFingerprint', () => {
  it('rejects wrong length / chars', () => {
    expect(isValidFingerprint('abc')).toBe(false);
    expect(isValidFingerprint('Z'.repeat(32))).toBe(false);
    expect(isValidFingerprint('a'.repeat(64))).toBe(false);
  });
});
