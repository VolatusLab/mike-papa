import type PgBoss from 'pg-boss';
import type { Logger } from '@bnmp/logger';
import { JobPermanentFailure, JobValidationFailed, type JobName } from '@bnmp/shared';
import type { JobHandler, WorkOptions } from '../types/index.js';

/**
 * Register a typed worker for a job name. Handler receives one job at a time
 * (we unfold the batch internally) plus a child logger bound to job/correlation ids.
 *
 * Errors:
 *   - JobValidationFailed / JobPermanentFailure → re-thrown; pg-boss marks as failed
 *     without further retries when retryLimit is exhausted (the no-retry signal is
 *     enforced at publish time by sending with `retryLimit: 0` for known-bad payloads).
 *   - Any other Error → thrown; pg-boss retries with exponential backoff per send opts.
 */
export async function registerWorker<N extends JobName>(
  boss: PgBoss,
  logger: Logger,
  name: N,
  handler: JobHandler<N>,
  opts: WorkOptions = {},
): Promise<void> {
  const baseLog = logger.child({ jobName: name });

  await boss.work<unknown>(
    name,
    {
      teamSize: opts.teamSize ?? 1,
      teamConcurrency: opts.teamConcurrency ?? 1,
      batchSize: opts.batchSize,
      newJobCheckIntervalSeconds: opts.newJobCheckIntervalSeconds ?? 5,
    } as PgBoss.WorkOptions,
    async (jobs) => {
      const batch = Array.isArray(jobs) ? jobs : [jobs];
      for (const rawJob of batch) {
        const job = rawJob as PgBoss.Job<unknown>;
        const data = (job.data ?? {}) as { correlationId?: string; tenantId?: string };
        const log = baseLog.child({
          jobId: job.id,
          correlationId: data.correlationId,
          tenantId: data.tenantId,
        });
        try {
          log.debug('job:start');
          await handler(job as Parameters<JobHandler<N>>[0], log);
          log.info('job:ok');
        } catch (err) {
          if (err instanceof JobPermanentFailure || err instanceof JobValidationFailed) {
            log.error({ err }, 'job:non-retryable');
          } else {
            log.warn({ err }, 'job:retryable-failure');
          }
          throw err;
        }
      }
    },
  );

  baseLog.info(
    { teamSize: opts.teamSize ?? 1, teamConcurrency: opts.teamConcurrency ?? 1 },
    'worker:registered',
  );
}
