import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { __bnmpPrisma?: PrismaClient };

export interface PrismaClientOptions {
  datasourceUrl?: string;
  logQueries?: boolean;
}

/** Factory — preferred in apps that want to manage lifecycle explicitly (worker). */
export function createPrismaClient(opts: PrismaClientOptions = {}): PrismaClient {
  return new PrismaClient({
    datasourceUrl: opts.datasourceUrl,
    log: opts.logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

/**
 * Lazy singleton — preferred in Next.js (avoids new-instance-per-HMR-reload).
 * Caller is responsible for `await client.$disconnect()` at process teardown
 * for non-Next.js processes; in Next.js this is unnecessary.
 */
export function getPrismaClient(opts: PrismaClientOptions = {}): PrismaClient {
  if (!globalForPrisma.__bnmpPrisma) {
    globalForPrisma.__bnmpPrisma = createPrismaClient(opts);
  }
  return globalForPrisma.__bnmpPrisma;
}

export type { PrismaClient } from '@prisma/client';
