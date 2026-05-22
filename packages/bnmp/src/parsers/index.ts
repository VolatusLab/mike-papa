import type { z } from 'zod';
import { BnmpResponseInvalid } from '@bnmp/shared';

export { BnmpWarrantSchema, type BnmpWarrant } from './warrant.js';
export { pagedSchema, type Paged } from './page.js';

/**
 * Parse a BNMP response, throwing BnmpResponseInvalid with the zod issues
 * attached as context for diagnostics. Use at every API boundary.
 */
export function parseBnmpResponse<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  context?: Record<string, unknown>,
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new BnmpResponseInvalid('BNMP response failed schema validation', {
      cause: result.error,
      context: { issues: result.error.issues, ...context },
    });
  }
  return result.data;
}
