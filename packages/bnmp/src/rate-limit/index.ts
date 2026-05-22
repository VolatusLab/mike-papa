import Bottleneck from 'bottleneck';

export interface RateLimiterOptions {
  /** target requests per minute */
  rpm: number;
  /** max concurrent in-flight (default 4) */
  maxConcurrent?: number;
}

/**
 * Bottleneck-backed rate limiter. Reservoir-based: refills `rpm` tokens once
 * per minute, with `minTime` (60_000/rpm ms) between starts as a guard so
 * we don't burst all `rpm` requests in the first second of a minute window.
 */
export class BnmpRateLimiter {
  private readonly limiter: Bottleneck;

  constructor(opts: RateLimiterOptions) {
    if (opts.rpm <= 0) throw new Error('rpm must be > 0');
    this.limiter = new Bottleneck({
      reservoir: opts.rpm,
      reservoirRefreshAmount: opts.rpm,
      reservoirRefreshInterval: 60_000,
      maxConcurrent: opts.maxConcurrent ?? 4,
      minTime: Math.ceil(60_000 / opts.rpm),
    });
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    return this.limiter.schedule(task);
  }

  async counts(): Promise<{ running: number; queued: number }> {
    const c = this.limiter.counts();
    return { running: c.RUNNING, queued: c.QUEUED };
  }

  async stop(): Promise<void> {
    await this.limiter.stop({ dropWaitingJobs: false });
  }
}
