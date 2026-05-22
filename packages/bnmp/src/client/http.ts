import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import type { CookieJar } from 'tough-cookie';
import type { Logger } from '@bnmp/logger';
import { BnmpRateLimited, BnmpRequestFailed, BnmpSessionExpired } from '@bnmp/shared';
import { exponentialBackoff, jitter, sleep } from '../utils/retry.js';

export interface HttpClientOptions {
  baseUrl: string;
  userAgent: string;
  fingerprint?: string;
  cookieJar?: CookieJar;
  timeoutMs?: number;
  logger: Logger;
}

/**
 * Axios instance pre-wired with:
 *   - cookie jar (per BnmpSession) via axios-cookiejar-support
 *   - User-Agent, Accept, Content-Type, fingerprint headers
 *   - request timeout (default 15s)
 *
 * The instance is throwaway-cheap — create per request batch / per session
 * acquisition; do not share across sessions (cookie jars must stay isolated).
 */
export function createHttpClient(opts: HttpClientOptions): AxiosInstance {
  // Cast to satisfy axios-cookiejar-support's AxiosRequestConfig extension.
  const config: AxiosRequestConfig & { jar?: CookieJar } = {
    baseURL: opts.baseUrl,
    timeout: opts.timeoutMs ?? 15_000,
    headers: {
      'User-Agent': opts.userAgent,
      Accept: 'application/json, application/octet-stream;q=0.9, */*;q=0.1',
      'Content-Type': 'application/json',
      ...(opts.fingerprint ? { fingerprint: opts.fingerprint } : {}),
    },
    withCredentials: true,
  };
  if (opts.cookieJar) config.jar = opts.cookieJar;

  const instance = axios.create(config);
  if (opts.cookieJar) wrapper(instance);
  return instance;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  logger: Logger;
}

/**
 * Execute an HTTP call with exponential backoff. Status taxonomy:
 *   - 401 / 403           → BnmpSessionExpired (caller must refresh + retry once)
 *   - 429 (after retries) → BnmpRateLimited
 *   - 400 / 404 / 422     → BnmpRequestFailed (permanent — do not retry)
 *   - 5xx, network, timeout → retried up to maxAttempts
 */
export async function requestWithRetry<T>(exec: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const log = opts.logger.child({ module: 'bnmp-http' });
  let lastErr: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await exec();
    } catch (err) {
      lastErr = err;

      if (err instanceof AxiosError) {
        const status = err.response?.status;

        // Permanent client errors — fail fast.
        if (status === 400 || status === 404 || status === 422) {
          throw new BnmpRequestFailed(`BNMP rejected request (${status})`, {
            cause: err,
            context: { status, url: err.config?.url },
          });
        }

        // Session expired — surface immediately for caller-driven refresh.
        if (status === 401 || status === 403) {
          throw new BnmpSessionExpired('BNMP session expired or forbidden', {
            cause: err,
            context: { status, url: err.config?.url },
          });
        }

        if (status === 429) {
          log.warn({ attempt, url: err.config?.url }, 'http:rate-limited');
        } else if (status && status >= 500) {
          log.warn({ attempt, status, url: err.config?.url }, 'http:5xx');
        } else {
          log.warn({ attempt, err: err.message }, 'http:network-error');
        }
      } else {
        log.warn({ attempt, err }, 'http:non-axios-error');
      }

      if (attempt === opts.maxAttempts) break;
      const delay = jitter(exponentialBackoff(attempt, opts.baseDelayMs));
      log.debug({ attempt, delay }, 'http:backoff');
      await sleep(delay);
    }
  }

  if (lastErr instanceof AxiosError && lastErr.response?.status === 429) {
    throw new BnmpRateLimited('BNMP rate limit exhausted', {
      cause: lastErr,
      context: { status: 429 },
    });
  }
  throw new BnmpRequestFailed('BNMP request failed after retries', { cause: lastErr });
}
