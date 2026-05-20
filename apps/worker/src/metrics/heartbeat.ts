import type { Logger } from '@bnmp/logger';

export interface HeartbeatOptions {
  logger: Logger;
  intervalMs?: number;
}

/**
 * Periodic heartbeat with process metrics. Used as a coarse liveness signal
 * in observability pipelines (a missing heartbeat → worker likely stuck).
 * Returns a stop() function for graceful shutdown.
 */
export function startHeartbeat(opts: HeartbeatOptions): () => void {
  const log = opts.logger.child({ module: 'heartbeat' });
  const intervalMs = opts.intervalMs ?? 60_000;
  let ticks = 0;

  const timer = setInterval(() => {
    ticks += 1;
    const mem = process.memoryUsage();
    log.info(
      {
        tick: ticks,
        uptimeSec: Math.round(process.uptime()),
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
      'heartbeat',
    );
  }, intervalMs);

  timer.unref();
  return () => clearInterval(timer);
}
