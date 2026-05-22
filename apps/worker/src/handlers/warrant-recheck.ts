import { JobValidationFailed, type JOB_NAMES } from '@bnmp/shared';
import type { JobHandler } from '@bnmp/queue';
import type { WorkerServices } from '../services/index.js';
import { syncWarrant } from '../services/warrant-sync.js';
import { filterForCity } from './filter.js';

/**
 * Re-fetch a single warrant and reconcile. BNMP doesn't expose a /by-id GET,
 * so we re-query the warrant's city filter and short-circuit when we find
 * the target bnmpId. Scans up to a generous page cap to handle status
 * changes that pushed the row down the listing.
 */
export function makeWarrantRecheckHandler(
  services: WorkerServices,
): JobHandler<typeof JOB_NAMES.WARRANT_RECHECK> {
  return async (job, log) => {
    const { tenantId, warrantId, bnmpId, correlationId } = job.data;
    const warrant = await services.repos.warrant.findById(tenantId, warrantId);
    if (!warrant) {
      throw new JobValidationFailed(`Warrant not found: ${warrantId}`);
    }
    const city = await services.repos.monitoredCity.findById(tenantId, warrant.monitoredCityId);
    if (!city) {
      throw new JobValidationFailed(`MonitoredCity not found: ${warrant.monitoredCityId}`);
    }

    const filter = filterForCity(city);
    const size = services.env.BNMP_SCAN_PAGE_SIZE;
    const maxPages = services.env.BNMP_RETROACTIVE_END_PAGE; // generous cap for recheck

    for (let page = 0; page < maxPages; page++) {
      const result = await services.bnmp.client.filterPage({ filter, page, size });
      const match = result.content.find((w) => w.id === bnmpId);
      if (match) {
        await syncWarrant(
          {
            prisma: services.prisma,
            warrantRepo: services.repos.warrant,
            warrantHistoryRepo: services.repos.warrantHistory,
            telegramConfigRepo: services.repos.telegramConfig,
            alertRepo: services.repos.alert,
            monitoredCityRepo: services.repos.monitoredCity,
            boss: services.boss,
            logger: services.logger,
          },
          { tenantId, monitoredCityId: warrant.monitoredCityId, correlationId },
          match,
        );
        log.info({ bnmpId, page }, 'recheck:matched');
        return;
      }
      if (result.last) break;
    }

    log.warn({ bnmpId }, 'recheck:not-found-in-listing');
  };
}
