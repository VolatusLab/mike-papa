import { JobValidationFailed, JOB_NAMES } from '@bnmp/shared';
import type { JobHandler } from '@bnmp/queue';
import type { WorkerServices } from '../services/index.js';
import { syncWarrant } from '../services/warrant-sync.js';
import { filterForCity } from './filter.js';

/**
 * Deeper scan for one city, covering pages [fromPage, toPage). Detects:
 *   - retroactive insertions (BNMP backfills records past dataExpedicao)
 *   - status changes on old warrants
 *
 * Same diff/upsert/notify pipeline as scan-city. No early-stop heuristic —
 * we want to traverse the whole window so insertions in the middle of the
 * page range get caught.
 */
export function makeRetroactiveScanHandler(
  services: WorkerServices,
): JobHandler<typeof JOB_NAMES.BNMP_RETROACTIVE_SCAN> {
  return async (job, log) => {
    const { tenantId, monitoredCityId, correlationId, fromPage, toPage } = job.data;
    const city = await services.repos.monitoredCity.findById(tenantId, monitoredCityId);
    if (!city) {
      throw new JobValidationFailed(`MonitoredCity not found: ${monitoredCityId}`, {
        context: { tenantId, monitoredCityId },
      });
    }
    if (!city.ativo || city.idMunicipio <= 0) {
      log.warn({ idMunicipio: city.idMunicipio, ativo: city.ativo }, 'retro-scan:skipped');
      return;
    }
    if (toPage <= fromPage) {
      throw new JobValidationFailed(`Invalid page range [${fromPage}, ${toPage})`);
    }

    const filter = filterForCity(city);
    const size = services.env.BNMP_SCAN_PAGE_SIZE;
    const stats = { fetched: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };

    try {
      for (let page = fromPage; page < toPage; page++) {
        const result = await services.bnmp.client.filterPage({ filter, page, size });
        for (const raw of result.content) {
          stats.fetched++;
          try {
            const r = await syncWarrant(
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
            if (r.outcome === 'created') stats.created++;
            else if (r.outcome === 'updated') stats.updated++;
            else stats.unchanged++;
          } catch (err) {
            stats.failed++;
            log.error({ err, bnmpId: raw.id }, 'retro-scan:row-failed');
          }
        }
        if (result.last) break;
      }
    } finally {
      await services.repos.monitoredCity.markRetroactiveScanned(tenantId, monitoredCityId);
    }

    log.info({ city: city.nome, fromPage, toPage, ...stats }, 'retro-scan:done');
    await services.repos.workerLog.append({
      level: stats.failed > 0 ? 'warn' : 'info',
      message: `Retroativo ${city.nome}/${city.uf} (pág ${fromPage}-${toPage}): ${stats.created} novos, ${stats.updated} alterados, ${stats.failed} falhas`,
      tenantId,
      correlationId,
      jobName: JOB_NAMES.BNMP_RETROACTIVE_SCAN,
      context: { fromPage, toPage, ...stats },
    });
  };
}
