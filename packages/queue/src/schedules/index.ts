import type PgBoss from 'pg-boss';
import type { JobName, JobPayloads } from '@bnmp/shared';

/**
 * Persistent cron schedule. pg-boss stores it in `pgboss.schedule` and re-creates
 * jobs on cadence even across worker restarts. Call once at boot (idempotent upsert).
 */
export async function scheduleCron<N extends JobName>(
  boss: PgBoss,
  name: N,
  cron: string,
  data: JobPayloads[N],
  options: PgBoss.ScheduleOptions = {},
): Promise<void> {
  await boss.schedule(name, cron, data as object, options);
}

export async function unscheduleCron(boss: PgBoss, name: string): Promise<void> {
  await boss.unschedule(name);
}
