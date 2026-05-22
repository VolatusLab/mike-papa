import { JOB_NAMES, type TickPayload } from '@bnmp/shared';
import { scheduleCron } from '@bnmp/queue';
import type { WorkerServices } from '../services/index.js';

const SYSTEM_TENANT = 'system';

/**
 * Install the two cron schedules pg-boss enforces server-side:
 *   1. BNMP_SCAN_TICK     — frequent fanout (env.BNMP_POLL_INTERVAL_CRON)
 *   2. BNMP_RETROACTIVE_TICK — daily deep fanout (env.BNMP_RETROACTIVE_CRON)
 *
 * pg-boss `schedule` is upsert-by-name, so this is idempotent. Each tick
 * handler fans out per-city work units (BNMP_SCAN_CITY / BNMP_RETROACTIVE_SCAN).
 */
export async function setupSchedules(services: WorkerServices): Promise<void> {
  const log = services.logger.child({ module: 'scheduler' });

  const tickPayload = (): TickPayload => ({
    tenantId: SYSTEM_TENANT,
    correlationId: 'cron-tick',
    enqueuedAt: new Date().toISOString(),
  });

  await scheduleCron(
    services.boss,
    JOB_NAMES.BNMP_SCAN_TICK,
    services.env.BNMP_POLL_INTERVAL_CRON,
    tickPayload(),
  );
  log.info({ cron: services.env.BNMP_POLL_INTERVAL_CRON }, 'schedule:scan-tick');

  await scheduleCron(
    services.boss,
    JOB_NAMES.BNMP_RETROACTIVE_TICK,
    services.env.BNMP_RETROACTIVE_CRON,
    tickPayload(),
  );
  log.info({ cron: services.env.BNMP_RETROACTIVE_CRON }, 'schedule:retroactive-tick');
}
