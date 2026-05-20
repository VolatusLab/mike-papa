import type { Logger } from '@bnmp/logger';

interface ShutdownTask {
  name: string;
  run: () => Promise<void>;
}

const tasks: ShutdownTask[] = [];
let shutdownRequested = false;
let resolveShutdown: (() => void) | null = null;

export function registerShutdown(name: string, run: () => Promise<void>): void {
  tasks.push({ name, run });
}

/**
 * Blocks the process until SIGINT/SIGTERM (or fatal error) fires, then runs
 * registered tasks in LIFO order. The returned promise resolves when all tasks
 * finish — caller can then exit cleanly.
 */
export function awaitShutdown(logger: Logger): Promise<void> {
  const log = logger.child({ module: 'shutdown' });

  return new Promise<void>((resolve) => {
    resolveShutdown = resolve;

    const handle = async (signal: string) => {
      if (shutdownRequested) {
        log.warn({ signal }, 'shutdown:signal-ignored (already in progress)');
        return;
      }
      shutdownRequested = true;
      log.info({ signal, tasks: tasks.length }, 'shutdown:starting');

      for (const task of [...tasks].reverse()) {
        try {
          log.info({ task: task.name }, 'shutdown:task:start');
          await task.run();
          log.info({ task: task.name }, 'shutdown:task:ok');
        } catch (err) {
          log.error({ err, task: task.name }, 'shutdown:task:fail');
        }
      }
      log.info('shutdown:done');
      resolveShutdown?.();
    };

    process.on('SIGINT', () => {
      void handle('SIGINT');
    });
    process.on('SIGTERM', () => {
      void handle('SIGTERM');
    });
    process.on('uncaughtException', (err) => {
      log.fatal({ err }, 'uncaughtException');
      void handle('uncaughtException').then(() => process.exit(1));
    });
    process.on('unhandledRejection', (reason) => {
      log.fatal({ err: reason }, 'unhandledRejection');
      void handle('unhandledRejection').then(() => process.exit(1));
    });
  });
}
