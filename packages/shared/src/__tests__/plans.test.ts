import { describe, expect, it } from 'vitest';
import { checkLimit, isPlan, PLAN_LIMITS, planLimits } from '../constants/plans.js';

describe('isPlan', () => {
  it('recognizes valid plan slugs', () => {
    expect(isPlan('free')).toBe(true);
    expect(isPlan('pro')).toBe(true);
    expect(isPlan('enterprise')).toBe(true);
  });
  it('rejects unknown slugs', () => {
    expect(isPlan('ultra')).toBe(false);
    expect(isPlan('')).toBe(false);
  });
});

describe('planLimits', () => {
  it('returns the matching limits', () => {
    expect(planLimits('pro')).toEqual(PLAN_LIMITS.pro);
    expect(planLimits('enterprise').maxCities).toBe(1000);
  });
  it('falls back to free on unknown plan', () => {
    expect(planLimits('garbage')).toEqual(PLAN_LIMITS.free);
    expect(planLimits('')).toEqual(PLAN_LIMITS.free);
  });
});

describe('checkLimit', () => {
  it('allows when under the cap', () => {
    expect(checkLimit(2, 3)).toEqual({ allowed: true, current: 2, max: 3, remaining: 1 });
  });
  it('blocks when at the cap', () => {
    expect(checkLimit(3, 3)).toEqual({ allowed: false, current: 3, max: 3, remaining: 0 });
  });
  it('blocks when over the cap and clamps remaining at 0', () => {
    const r = checkLimit(5, 3);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
});
