import PgBoss from 'pg-boss';
import type { Logger } from '@bnmp/logger';

export interface BossOptions {
  connectionString: string;
  schema: string;
  logger: Logger;
  /** default retry limit applied at job-send time when not overridden */
  defaultRetryLimit?: number;
}

export interface ManagedBoss {
  readonly boss: PgBoss;
  stop(): Promise<void>;
}

/**
 * Boot pg-boss with sane defaults and a structured-log error sink.
 * The returned `stop()` is graceful: drains in-flight jobs before closing the pool.
 */
export async function startBoss(opts: BossOptions): Promise<ManagedBoss> {
  const log = opts.logger.child({ module: 'pg-boss', schema: opts.schema });

  const boss = new PgBoss({
    connectionString: opts.connectionString,
    schema: opts.schema,
    retryLimit: opts.defaultRetryLimit ?? 5,
    retryBackoff: true,
    retryDelay: 30,
    expireInHours: 24,
    deleteAfterDays: 14,
    monitorStateIntervalSeconds: 30,
  });

  boss.on('error', (err) => log.error({ err }, 'pg-boss runtime error'));
  boss.on('monitor-states', (states) => log.debug({ states }, 'pg-boss queue snapshot'));

  await boss.start();
  log.info('pg-boss started');

  return {
    boss,
    async stop() {
      log.info('pg-boss stopping (graceful drain, 30s timeout)');
      // pg-boss 10: stop returns once in-flight jobs finish OR timeout fires
      await boss.stop({ graceful: true, timeout: 30_000, close: true });
      log.info('pg-boss stopped');
    },
  };
}
