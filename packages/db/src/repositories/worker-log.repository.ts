import type { PrismaClient, WorkerLog } from '@prisma/client';
import { clampLimit, type ListOptions } from '../types.js';

export interface AppendWorkerLogInput {
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  message: string;
  tenantId?: string | null;
  correlationId?: string | null;
  jobName?: string | null;
  context?: unknown;
}

export class WorkerLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  append(input: AppendWorkerLogInput): Promise<WorkerLog> {
    return this.prisma.workerLog.create({
      data: {
        level: input.level,
        message: input.message,
        tenantId: input.tenantId ?? null,
        correlationId: input.correlationId ?? null,
        jobName: input.jobName ?? null,
        context: (input.context ?? undefined) as object | undefined,
      },
    });
  }

  listByTenant(tenantId: string, opts: ListOptions = {}): Promise<WorkerLog[]> {
    return this.prisma.workerLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
  }

  /** Coarse retention sweep — called from a low-priority pg-boss job. */
  async purgeOlderThan(days: number): Promise<number> {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const r = await this.prisma.workerLog.deleteMany({
      where: { createdAt: { lt: threshold } },
    });
    return r.count;
  }
}
