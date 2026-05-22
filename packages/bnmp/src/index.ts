// @bnmp/bnmp — public barrel.
// REGRA: não exportar DTOs cruas (dto/), helpers de teste, nem utils internos.

export { BnmpClient } from './client/index.js';
export type { BnmpClientOptions, FilterPageRequest } from './client/index.js';

export { BnmpSessionManager } from './session/index.js';
export type { SessionManagerOptions, AcquiredSession } from './session/index.js';
export { generateFingerprint, isValidFingerprint } from './session/fingerprint.js';
export { decodeJwt, jwtExpired, type JwtPayload } from './session/jwt.js';
export { extractPortalCookie, PORTAL_COOKIE_NAME } from './session/cookie.js';

export { BnmpRateLimiter, type RateLimiterOptions } from './rate-limit/index.js';

export {
  BnmpWarrantSchema,
  pagedSchema,
  parseBnmpResponse,
  type BnmpWarrant,
  type Paged,
} from './parsers/index.js';

export {
  normalizeName,
  deaccent,
  nameKey,
  parseIsoDate,
  formatIsoDate,
  canonicalizeStatus,
  type CanonicalStatus,
  canonicalize,
  snapshotHash,
} from './normalizers/index.js';

export {
  downloadPdf,
  isPdfBytes,
  parsePdfFilename,
  type DownloadPdfRequest,
  type DownloadedPdf,
} from './pdf/index.js';

export type {
  IsoDate,
  IsoDateTime,
  BnmpFilter,
  BnmpPageParams,
  BnmpPagedResult,
  BnmpSessionState,
} from './types/index.js';
