import type PgBoss from 'pg-boss';
import type { JobName, JobPayloads } from '@bnmp/shared';

/**
 * Typed publisher. Returns pg-boss job id (null if a singleton/dedupe key collided).
 */
export async function publishJob<N extends JobName>(
  boss: PgBoss,
  name: N,
  data: JobPayloads[N],
  options: PgBoss.SendOptions = {},
): Promise<string | null> {
  return boss.send(name, data as object, options);
}

/**
 * Publish with deduplication — pg-boss singletonKey skips if a job with the same
 * key is queued / active within `singletonHours`. Use for natural idempotency.
 */
export async function publishSingletonJob<N extends JobName>(
  boss: PgBoss,
  name: N,
  data: JobPayloads[N],
  singletonKey: string,
  options: Omit<PgBoss.SendOptions, 'singletonKey'> = {},
): Promise<string | null> {
  return boss.send(name, data as object, { ...options, singletonKey });
}
