import { createLogger, newCorrelationId } from '@bnmp/logger';
import { parseEnv, workerEnvSchema } from '@bnmp/shared';
import { startBoss } from '@bnmp/queue';
import { startHealthServer } from './server/health.js';
import { awaitShutdown, registerShutdown } from './lifecycle/shutdown.js';
import { startHeartbeat } from './metrics/heartbeat.js';
import { registerAllHandlers } from './queue/register-handlers.js';
import { buildServices } from './services/index.js';
import { setupSchedules } from './scheduler/index.js';

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
      retro: env.BNMP_RETROACTIVE_CRON,
      rateLimitRpm: env.BNMP_RATE_LIMIT_RPM,
      sessionPoolSize: env.BNMP_SESSION_POOL_SIZE,
      pgbossSchema: env.PGBOSS_SCHEMA,
    },
    'worker:starting',
  );

  const managedBoss = await startBoss({
    connectionString: env.DATABASE_URL,
    schema: env.PGBOSS_SCHEMA,
    logger,
  });

  const services = buildServices(env, managedBoss.boss, logger);

  await registerAllHandlers(services);
  await setupSchedules(services);

  const state = { ready: false };
  const healthServer = startHealthServer({
    port: env.WORKER_PORT,
    logger,
    boss: managedBoss.boss,
    state,
  });
  const stopHeartbeat = startHeartbeat({ logger, intervalMs: 60_000 });

  // Shutdown LIFO: heartbeat → http → services (prisma + bnmp) → pg-boss.
  registerShutdown('heartbeat', async () => {
    stopHeartbeat();
  });
  registerShutdown('health-server', async () => {
    await healthServer.close();
  });
  registerShutdown('services', async () => {
    await services.stop();
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
