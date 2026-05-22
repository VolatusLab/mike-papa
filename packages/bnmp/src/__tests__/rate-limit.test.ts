import { describe, expect, it } from 'vitest';
import { BnmpRateLimiter } from '../rate-limit/index.js';

describe('BnmpRateLimiter', () => {
  it('runs N tasks under minTime spacing', async () => {
    const limiter = new BnmpRateLimiter({ rpm: 600, maxConcurrent: 2 });
    const start = Date.now();
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => limiter.schedule(async () => i * 2)),
    );
    expect(results).toEqual([0, 2, 4, 6]);
    // 600rpm → minTime 100ms; with maxConcurrent 2 and 4 tasks we expect ≥ ~200ms.
    expect(Date.now() - start).toBeGreaterThanOrEqual(150);
    await limiter.stop();
  });

  it('rejects non-positive rpm', () => {
    expect(() => new BnmpRateLimiter({ rpm: 0 })).toThrow();
  });

  it('reports counts', async () => {
    const limiter = new BnmpRateLimiter({ rpm: 600 });
    const counts = await limiter.counts();
    expect(counts.running).toBe(0);
    expect(counts.queued).toBe(0);
    await limiter.stop();
  });
});
