import { createServer, type Server } from 'node:http';
import type PgBoss from 'pg-boss';
import type { Logger } from '@bnmp/logger';
import { snapshotQueues } from '@bnmp/queue';
import { JOB_NAMES, type JobName } from '@bnmp/shared';

export interface HealthServerOptions {
  port: number;
  logger: Logger;
  boss: PgBoss;
  state: { ready: boolean };
}

export interface HealthServer {
  close(): Promise<void>;
}

const KNOWN_JOBS = Object.values(JOB_NAMES) as JobName[];

/**
 * Endpoints:
 *   GET /health/live    → 200 if process is alive (k8s/Railway liveness)
 *   GET /health/ready   → 200 if startup finished & dependencies up
 *   GET /health/worker  → 200 with queue depth snapshot (observability)
 */
export function startHealthServer(opts: HealthServerOptions): HealthServer {
  const log = opts.logger.child({ module: 'health' });
  const startedAt = new Date().toISOString();

  const server: Server = createServer((req, res) => {
    const url = req.url ?? '/';
    res.setHeader('content-type', 'application/json; charset=utf-8');

    void (async () => {
      try {
        if (url === '/health/live') {
          res.statusCode = 200;
          res.end(JSON.stringify({ status: 'live', startedAt }));
          return;
        }
        if (url === '/health/ready') {
          if (opts.state.ready) {
            res.statusCode = 200;
            res.end(JSON.stringify({ status: 'ready' }));
          } else {
            res.statusCode = 503;
            res.end(JSON.stringify({ status: 'starting' }));
          }
          return;
        }
        if (url === '/health/worker') {
          const queues = await snapshotQueues(opts.boss, KNOWN_JOBS);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              status: opts.state.ready ? 'ready' : 'starting',
              startedAt,
              uptimeSec: Math.round(process.uptime()),
              queues,
            }),
          );
          return;
        }
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'not_found' }));
      } catch (err) {
        log.error({ err, url }, 'health endpoint error');
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'internal_error' }));
      }
    })();
  });

  server.listen(opts.port, () => log.info({ port: opts.port }, 'health server listening'));

  return {
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
