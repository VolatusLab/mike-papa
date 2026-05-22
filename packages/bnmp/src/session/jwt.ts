/**
 * Decode-only JWT helpers. We DO NOT verify the signature — these tokens are
 * portal-issued anonymous sessions we don't share a secret with. Reading
 * `exp` is enough to schedule refreshes before the server starts 401-ing.
 */

export interface JwtPayload {
  exp?: number; // unix seconds
  iat?: number; // unix seconds
  authorities?: string[]; // observed: ["ROLE_ANONYMOUS"]
  [k: string]: unknown;
}

export function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const segment = parts[1];
  if (!segment) return null;
  try {
    const payload = Buffer.from(segment, 'base64url').toString('utf-8');
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === 'object') return parsed as JwtPayload;
    return null;
  } catch {
    return null;
  }
}

/**
 * `true` if the token is past its `exp` (minus `skewSeconds` safety buffer).
 * Tokens without `exp` are treated as never-expiring (defensive — caller should
 * still rotate on 401).
 */
export function jwtExpired(token: string, skewSeconds = 60): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - skewSeconds <= now;
}
