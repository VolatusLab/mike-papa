import 'server-only';
import { env } from '@/env.server';

export interface WorkerQueueDepth {
  name: string;
  created: number;
  retry: number;
  active: number;
  failed: number;
}

export interface WorkerHealth {
  status: string;
  startedAt: string;
  uptimeSec: number;
  queues: WorkerQueueDepth[];
}

/**
 * Fetch the worker's /health/worker endpoint. Returns null when WORKER_HEALTH_URL
 * is not configured or the worker is unreachable — the admin page renders a
 * "not configured / offline" state in that case.
 */
export async function fetchWorkerHealth(): Promise<WorkerHealth | null> {
  if (!env.WORKER_HEALTH_URL) return null;
  try {
    const res = await fetch(`${env.WORKER_HEALTH_URL}/health/worker`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as WorkerHealth;
  } catch {
    return null;
  }
}
