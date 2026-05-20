import type PgBoss from 'pg-boss';
import type { Logger } from '@bnmp/logger';
import { registerWorker, type WorkOptions } from '@bnmp/queue';
import { JOB_NAMES, type JobName } from '@bnmp/shared';

interface HandlerSpec {
  name: JobName;
  options: WorkOptions;
}

// Concurrency tuned conservatively. Real handlers arrive in Etapas 6–8.
const HANDLER_SPECS: readonly HandlerSpec[] = [
  { name: JOB_NAMES.BNMP_SCAN_CITY, options: { teamSize: 4, teamConcurrency: 2 } },
  { name: JOB_NAMES.BNMP_RETROACTIVE_SCAN, options: { teamSize: 1, teamConcurrency: 1 } },
  { name: JOB_NAMES.WARRANT_RECHECK, options: { teamSize: 2, teamConcurrency: 1 } },
  { name: JOB_NAMES.PDF_DOWNLOAD, options: { teamSize: 2, teamConcurrency: 1 } },
  { name: JOB_NAMES.TELEGRAM_SEND_ALERT, options: { teamSize: 2, teamConcurrency: 1 } },
];

/**
 * Stage 2: register stub handlers so pg-boss knows the queues exist and
 * doesn't reject sends. Each handler logs and no-ops. Real implementations
 * replace these in the relevant later stages.
 */
export async function registerAllHandlers(boss: PgBoss, logger: Logger): Promise<void> {
  for (const spec of HANDLER_SPECS) {
    await registerWorker(
      boss,
      logger,
      spec.name,
      async (_job, log) => {
        log.warn({ stage: 2 }, 'handler:not-implemented');
      },
      spec.options,
    );
  }
}
