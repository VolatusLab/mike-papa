import type { Logger } from '@bnmp/logger';
import { TelegramSendFailed } from '@bnmp/shared';

/** Sleep ms — returns a resolving promise. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface InCallRetryOptions {
  logger: Logger;
  /** retry_after threshold (ms) under which we sleep+retry in-process.
   *  Above this we throw so pg-boss reschedules with backoff. Default 5_000. */
  maxRetryAfterMs?: number;
  /** Max in-call retries for transient errors (5xx, network). Default 1. */
  maxRetries?: number;
}

/**
 * Wrap a Bot API call with conservative in-call retry. The handler still
 * surfaces unrecoverable errors so pg-boss can retry/dead-letter. We only
 * absorb the obvious wins (short 429 retry_after, single 5xx retry).
 */
export async function withTelegramRetry<T>(
  exec: () => Promise<T>,
  opts: InCallRetryOptions,
): Promise<T> {
  const log = opts.logger.child({ module: 'telegram-retry' });
  const maxRetryAfterMs = opts.maxRetryAfterMs ?? 5_000;
  const maxRetries = opts.maxRetries ?? 1;

  // Bounded: initial attempt + up to maxRetries retries (+1 slack iteration).
  for (let attempt = 1; attempt <= maxRetries + 2; attempt++) {
    try {
      return await exec();
    } catch (err) {
      if (!(err instanceof TelegramSendFailed)) throw err;

      const ctx = (err.context ?? {}) as {
        httpStatus?: number;
        errorCode?: number;
        retryAfter?: number;
      };

      // 429 — respect retry_after if short enough
      if (ctx.httpStatus === 429 && typeof ctx.retryAfter === 'number') {
        const waitMs = ctx.retryAfter * 1_000;
        if (waitMs <= maxRetryAfterMs && attempt <= maxRetries) {
          log.warn({ attempt, waitMs }, 'telegram:retry-after-sleep');
          await sleep(waitMs + 250);
          continue;
        }
        // long backoff — let pg-boss handle it
        throw err;
      }

      // transient (5xx or no status — likely network)
      const transient =
        ctx.httpStatus === undefined || (ctx.httpStatus >= 500 && ctx.httpStatus < 600);
      if (transient && attempt <= maxRetries) {
        const waitMs = 500 * 2 ** (attempt - 1);
        log.warn({ attempt, waitMs, httpStatus: ctx.httpStatus }, 'telegram:transient-retry');
        await sleep(waitMs);
        continue;
      }

      throw err;
    }
  }
  // Unreachable in practice — every path above either returns or throws.
  throw new TelegramSendFailed('Telegram retry loop exhausted');
}
