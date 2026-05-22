import { randomUUID } from 'node:crypto';
import { JOB_NAMES, type ScanCityPayload } from '@bnmp/shared';
import { publishSingletonJob, type JobHandler } from '@bnmp/queue';
import type { WorkerServices } from '../services/index.js';

/**
 * Fanout tick — scheduled via pg-boss cron at BNMP_POLL_INTERVAL_CRON.
 * Lists every active monitored city across all tenants and enqueues one
 * `bnmp.scan.city` job per city, deduped by singletonKey so overlapping
 * ticks don't pile up if a previous scan is still in flight.
 */
export function makeScanTickHandler(
  services: WorkerServices,
): JobHandler<typeof JOB_NAMES.BNMP_SCAN_TICK> {
  return async (_job, log) => {
    const cities = await services.repos.monitoredCity.listAllActive();
    log.info({ cityCount: cities.length }, 'scan-tick:fanout');
    if (cities.length === 0) return;

    const now = new Date().toISOString();
    const correlationId = randomUUID();
    let enqueued = 0;
    let skipped = 0;

    for (const city of cities) {
      const payload: ScanCityPayload = {
        tenantId: city.tenantId,
        correlationId,
        enqueuedAt: now,
        monitoredCityId: city.id,
        page: 0,
        size: services.env.BNMP_SCAN_PAGE_SIZE,
      };
      const jobId = await publishSingletonJob(
        services.boss,
        JOB_NAMES.BNMP_SCAN_CITY,
        payload,
        `scan:${city.id}`,
      );
      if (jobId) enqueued++;
      else skipped++;
    }

    log.info({ enqueued, skipped }, 'scan-tick:done');
  };
}
