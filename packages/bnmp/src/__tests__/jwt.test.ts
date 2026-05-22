import { describe, expect, it } from 'vitest';
import { decodeJwt, jwtExpired } from '../session/jwt.js';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesignature`;
}

describe('decodeJwt', () => {
  it('decodes a well-formed token', () => {
    const t = makeJwt({ exp: 1234567890, authorities: ['ROLE_ANONYMOUS'] });
    const p = decodeJwt(t);
    expect(p?.exp).toBe(1234567890);
    expect(p?.authorities).toEqual(['ROLE_ANONYMOUS']);
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwt('not.a.jwt.really')).toBeNull();
    expect(decodeJwt('only.one')).toBeNull();
    expect(decodeJwt('')).toBeNull();
  });
});

describe('jwtExpired', () => {
  it('returns true when past exp', () => {
    const t = makeJwt({ exp: Math.floor(Date.now() / 1000) - 100 });
    expect(jwtExpired(t, 0)).toBe(true);
  });
  it('returns false when comfortably in the future', () => {
    const t = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(jwtExpired(t, 60)).toBe(false);
  });
  it('respects skew', () => {
    const t = makeJwt({ exp: Math.floor(Date.now() / 1000) + 30 });
    // 60s skew → effectively already expired
    expect(jwtExpired(t, 60)).toBe(true);
  });
  it('returns false when no exp claim (defensive)', () => {
    const t = makeJwt({ authorities: ['ROLE_ANONYMOUS'] });
    expect(jwtExpired(t)).toBe(false);
  });
});
