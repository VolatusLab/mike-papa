import type PgBoss from 'pg-boss';
import type { Logger } from '@bnmp/logger';
import type { JobName, JobPayloads } from '@bnmp/shared';

export type JobOf<N extends JobName> = PgBoss.Job<JobPayloads[N]>;

export type JobHandler<N extends JobName> = (job: JobOf<N>, log: Logger) => Promise<void>;

export interface WorkOptions {
  /** total parallel jobs for this worker registration */
  teamSize?: number;
  /** parallel handler invocations per fetched batch */
  teamConcurrency?: number;
  /** how many jobs to fetch per poll */
  batchSize?: number;
  /** how often to poll for new jobs */
  newJobCheckIntervalSeconds?: number;
}
