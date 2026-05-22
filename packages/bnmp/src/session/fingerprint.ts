import { createHash, randomBytes } from 'node:crypto';

/**
 * Stable-ish browser-like fingerprint expected by the BNMP portal as the
 * `fingerprint` request header. Reverse-engineered: portal accepts a 32-char
 * hex string. We don't simulate a real browser fingerprint — a per-session
 * random hash is sufficient and rotates with the session.
 */
export function generateFingerprint(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex').slice(0, 32);
}

export function isValidFingerprint(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value);
}
