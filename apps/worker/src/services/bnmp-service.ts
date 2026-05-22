import type { Logger } from '@bnmp/logger';
import type { WorkerEnv } from '@bnmp/shared';
import { BnmpClient, BnmpRateLimiter, BnmpSessionManager } from '@bnmp/bnmp';

export interface BnmpService {
  readonly client: BnmpClient;
  readonly sessionManager: BnmpSessionManager;
  readonly rateLimiter: BnmpRateLimiter;
  stop(): Promise<void>;
}

/**
 * Process-wide BNMP service. One session pool + one rate limiter shared by
 * every handler. Boot once at worker startup; stop on graceful shutdown.
 */
export function createBnmpService(env: WorkerEnv, logger: Logger): BnmpService {
  const sessionManager = new BnmpSessionManager({
    baseUrl: env.BNMP_BASE_URL,
    userAgent: env.BNMP_USER_AGENT,
    logger,
    poolSize: env.BNMP_SESSION_POOL_SIZE,
  });
  const rateLimiter = new BnmpRateLimiter({
    rpm: env.BNMP_RATE_LIMIT_RPM,
    maxConcurrent: env.BNMP_MAX_CONCURRENT,
  });
  const client = new BnmpClient({
    baseUrl: env.BNMP_BASE_URL,
    userAgent: env.BNMP_USER_AGENT,
    logger,
    sessionManager,
    rateLimiter,
  });
  return {
    client,
    sessionManager,
    rateLimiter,
    async stop() {
      await rateLimiter.stop();
    },
  };
}
