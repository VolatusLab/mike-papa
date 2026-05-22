import { randomUUID } from 'node:crypto';
import { JOB_NAMES, type RetroactiveScanPayload } from '@bnmp/shared';
import { publishSingletonJob, type JobHandler } from '@bnmp/queue';
import type { WorkerServices } from '../services/index.js';

/**
 * Daily fanout — pushes deeper-page scans for every active city to catch
 * warrants that were inserted retroactively (BNMP can backfill records
 * weeks after dataExpedicao).
 */
export function makeRetroactiveTickHandler(
  services: WorkerServices,
): JobHandler<typeof JOB_NAMES.BNMP_RETROACTIVE_TICK> {
  return async (_job, log) => {
    const cities = await services.repos.monitoredCity.listAllActive();
    if (cities.length === 0) {
      log.info('retroactive-tick:no-active-cities');
      return;
    }

    const now = new Date().toISOString();
    const correlationId = randomUUID();
    let enqueued = 0;
    let skipped = 0;

    for (const city of cities) {
      const payload: RetroactiveScanPayload = {
        tenantId: city.tenantId,
        correlationId,
        enqueuedAt: now,
        monitoredCityId: city.id,
        fromPage: services.env.BNMP_RETROACTIVE_START_PAGE,
        toPage: services.env.BNMP_RETROACTIVE_END_PAGE,
      };
      const jobId = await publishSingletonJob(
        services.boss,
        JOB_NAMES.BNMP_RETROACTIVE_SCAN,
        payload,
        `retro:${city.id}`,
      );
      if (jobId) enqueued++;
      else skipped++;
    }

    log.info({ enqueued, skipped, cityCount: cities.length }, 'retroactive-tick:done');
  };
}
