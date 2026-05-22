import { JOB_NAMES } from '@bnmp/shared';
import { registerWorker } from '@bnmp/queue';
import type { WorkerServices } from '../services/index.js';
import {
  makePdfDownloadHandler,
  makeRetroactiveScanHandler,
  makeRetroactiveTickHandler,
  makeScanCityHandler,
  makeScanTickHandler,
  makeTelegramSendAlertHandler,
  makeWarrantRecheckHandler,
} from '../handlers/index.js';

/**
 * Wire every JOB_NAME to its handler. Concurrency tuned per workload:
 *   - ticks         → 1 / 1   (fanout is cheap; multiple in-flight would dup-queue)
 *   - scan-city     → 4 / 2   (network-bound; multi-tenant parallelism)
 *   - retroactive-scan → 1 / 1 (heavy multi-page traversal)
 *   - warrant-recheck → 2 / 1
 *   - telegram-send-alert → 3 / 2 (network-bound; per-chat limiter inside service)
 *   - pdf-download  → 2 / 1   (download + storage upload)
 */
export async function registerAllHandlers(services: WorkerServices): Promise<void> {
  const { boss, logger } = services;

  await registerWorker(boss, logger, JOB_NAMES.BNMP_SCAN_TICK, makeScanTickHandler(services), {
    teamSize: 1,
    teamConcurrency: 1,
  });
  await registerWorker(
    boss,
    logger,
    JOB_NAMES.BNMP_RETROACTIVE_TICK,
    makeRetroactiveTickHandler(services),
    {
      teamSize: 1,
      teamConcurrency: 1,
    },
  );

  await registerWorker(boss, logger, JOB_NAMES.BNMP_SCAN_CITY, makeScanCityHandler(services), {
    teamSize: 4,
    teamConcurrency: 2,
  });
  await registerWorker(
    boss,
    logger,
    JOB_NAMES.BNMP_RETROACTIVE_SCAN,
    makeRetroactiveScanHandler(services),
    {
      teamSize: 1,
      teamConcurrency: 1,
    },
  );
  await registerWorker(
    boss,
    logger,
    JOB_NAMES.WARRANT_RECHECK,
    makeWarrantRecheckHandler(services),
    {
      teamSize: 2,
      teamConcurrency: 1,
    },
  );

  await registerWorker(boss, logger, JOB_NAMES.PDF_DOWNLOAD, makePdfDownloadHandler(services), {
    teamSize: 2,
    teamConcurrency: 1,
  });
  await registerWorker(
    boss,
    logger,
    JOB_NAMES.TELEGRAM_SEND_ALERT,
    makeTelegramSendAlertHandler(services),
    { teamSize: 3, teamConcurrency: 2 },
  );
}
