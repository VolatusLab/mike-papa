import { describe, expect, it } from 'vitest';
import { exponentialBackoff, jitter, sleep } from '../utils/retry.js';

describe('exponentialBackoff', () => {
  it('doubles per attempt and caps at capMs', () => {
    expect(exponentialBackoff(1, 100)).toBe(100);
    expect(exponentialBackoff(2, 100)).toBe(200);
    expect(exponentialBackoff(3, 100)).toBe(400);
    expect(exponentialBackoff(10, 100, 1000)).toBe(1000);
  });
});

describe('jitter', () => {
  it('stays within ±25% of input', () => {
    for (let i = 0; i < 200; i++) {
      const j = jitter(1000);
      expect(j).toBeGreaterThanOrEqual(750);
      expect(j).toBeLessThanOrEqual(1250);
    }
  });
});

describe('sleep', () => {
  it('waits ~the requested duration', async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });
});
