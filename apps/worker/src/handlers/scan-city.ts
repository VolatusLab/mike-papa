import { JobValidationFailed, JOB_NAMES } from '@bnmp/shared';
import type { JobHandler } from '@bnmp/queue';
import type { WorkerServices } from '../services/index.js';
import { syncWarrant } from '../services/warrant-sync.js';
import { filterForCity } from './filter.js';

/**
 * Scan the FIRST N pages of a single city.
 *   - N = env.BNMP_SCAN_MAX_PAGES (default 3)
 *   - page size = payload.size ?? env.BNMP_SCAN_PAGE_SIZE
 *   - Each warrant flows through syncWarrant → upsert + history + alerts
 *   - markScanned at end (records lastScanAt for observability)
 *
 * Stops early on three signals:
 *   1. paged.last === true
 *   2. consecutive `unchanged` warrants > 2 pages worth (likely caught up)
 *   3. unrecoverable error in syncWarrant for a specific row (logs + continues)
 */
export function makeScanCityHandler(
  services: WorkerServices,
): JobHandler<typeof JOB_NAMES.BNMP_SCAN_CITY> {
  return async (job, log) => {
    const { tenantId, monitoredCityId, correlationId } = job.data;
    const city = await services.repos.monitoredCity.findById(tenantId, monitoredCityId);
    if (!city) {
      throw new JobValidationFailed(`MonitoredCity not found: ${monitoredCityId}`, {
        context: { tenantId, monitoredCityId },
      });
    }
    if (!city.ativo) {
      log.warn('scan-city:skipped (city inactive)');
      return;
    }
    if (city.idMunicipio <= 0) {
      log.warn({ idMunicipio: city.idMunicipio }, 'scan-city:skipped (idMunicipio placeholder)');
      return;
    }

    const filter = filterForCity(city);
    const size = job.data.size ?? services.env.BNMP_SCAN_PAGE_SIZE;
    const maxPages = services.env.BNMP_SCAN_MAX_PAGES;

    const stats = { fetched: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
    let consecutiveUnchanged = 0;
    const EARLY_STOP_THRESHOLD = size * 2;

    try {
      const iter = services.bnmp.client.iterateAll({ filter, page: 0, size });
      let pageBudget = maxPages * size;

      for await (const raw of iter) {
        if (pageBudget-- <= 0) break;
        stats.fetched++;
        try {
          const result = await syncWarrant(
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
            { tenantId, monitoredCityId, correlationId },
            raw,
          );
          if (result.outcome === 'created') {
            stats.created++;
            consecutiveUnchanged = 0;
          } else if (result.outcome === 'updated') {
            stats.updated++;
            consecutiveUnchanged = 0;
          } else {
            stats.unchanged++;
            consecutiveUnchanged++;
            if (consecutiveUnchanged >= EARLY_STOP_THRESHOLD) {
              log.info({ consecutiveUnchanged }, 'scan-city:early-stop (caught up)');
              break;
            }
          }
        } catch (err) {
          stats.failed++;
          log.error({ err, bnmpId: raw.id }, 'scan-city:row-failed');
        }
      }
    } finally {
      await services.repos.monitoredCity.markScanned(tenantId, monitoredCityId);
    }

    log.info({ city: city.nome, ...stats }, 'scan-city:done');
    await services.repos.workerLog.append({
      level: stats.failed > 0 ? 'warn' : 'info',
      message: `Scan ${city.nome}/${city.uf}: ${stats.created} novos, ${stats.updated} alterados, ${stats.unchanged} inalterados, ${stats.failed} falhas`,
      tenantId,
      correlationId,
      jobName: JOB_NAMES.BNMP_SCAN_CITY,
      context: stats,
    });
  };
}
