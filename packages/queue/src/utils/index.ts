import type PgBoss from 'pg-boss';
import type { JobName } from '@bnmp/shared';

export const RETRY_POLICY = {
  /** standard transient-failure retry (network, BNMP rate limit, telegram 429) */
  TRANSIENT: { retryLimit: 5, retryBackoff: true, retryDelay: 30 } satisfies PgBoss.SendOptions,
  /** zero retries — for known-bad payloads we want to fail fast */
  NONE: { retryLimit: 0 } satisfies PgBoss.SendOptions,
  /** long-tailed retry for PDF download (BNMP can be flaky) */
  PDF: { retryLimit: 8, retryBackoff: true, retryDelay: 60 } satisfies PgBoss.SendOptions,
} as const;

export interface QueueDepthSnapshot {
  name: JobName;
  created: number;
  retry: number;
  active: number;
  failed: number;
}

/**
 * Cheap queue depth snapshot for observability. Used by /health/worker.
 * Reads counts via pg-boss `getQueueSize` (single query per name).
 */
export async function snapshotQueues(
  boss: PgBoss,
  names: readonly JobName[],
): Promise<QueueDepthSnapshot[]> {
  const snapshots: QueueDepthSnapshot[] = [];
  for (const name of names) {
    const created = await boss.getQueueSize(name, { before: 'active' });
    snapshots.push({ name, created, retry: 0, active: 0, failed: 0 });
  }
  return snapshots;
}
