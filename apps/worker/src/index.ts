import { createLogger, newCorrelationId } from '@bnmp/logger';
import { parseEnv, workerEnvSchema } from '@bnmp/shared';
import { startBoss } from '@bnmp/queue';
import { startHealthServer } from './server/health.js';
import { awaitShutdown, registerShutdown } from './lifecycle/shutdown.js';
import { startHeartbeat } from './metrics/heartbeat.js';
import { registerAllHandlers } from './queue/register-handlers.js';

const env = parseEnv(workerEnvSchema);
const logger = createLogger({
  service: 'worker',
  level: env.LOG_LEVEL,
  env: env.NODE_ENV,
});
const bootLog = logger.child({ correlationId: newCorrelationId(), phase: 'boot' });

async function main(): Promise<void> {
  bootLog.info(
    {
      port: env.WORKER_PORT,
      poll: env.BNMP_POLL_INTERVAL_CRON,
      rateLimitRpm: env.BNMP_RATE_LIMIT_RPM,
      pgbossSchema: env.PGBOSS_SCHEMA,
    },
    'worker:starting',
  );

  const managedBoss = await startBoss({
    connectionString: env.DATABASE_URL,
    schema: env.PGBOSS_SCHEMA,
    logger,
  });

  await registerAllHandlers(managedBoss.boss, logger);

  const state = { ready: false };
  const healthServer = startHealthServer({
    port: env.WORKER_PORT,
    logger,
    boss: managedBoss.boss,
    state,
  });
  const stopHeartbeat = startHeartbeat({ logger, intervalMs: 60_000 });

  // Shutdown LIFO: heartbeat → http server → pg-boss (drain in-flight jobs last).
  registerShutdown('heartbeat', async () => {
    stopHeartbeat();
  });
  registerShutdown('health-server', async () => {
    await healthServer.close();
  });
  registerShutdown('pg-boss', async () => {
    await managedBoss.stop();
  });

  state.ready = true;
  bootLog.info('worker:ready');

  await awaitShutdown(logger);
  bootLog.info('worker:exited');
}

main().catch((err) => {
  bootLog.fatal({ err }, 'worker:fatal');
  process.exit(1);
});
