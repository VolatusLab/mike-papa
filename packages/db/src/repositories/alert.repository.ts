import type { Alert, AlertStatus, PrismaClient } from '@prisma/client';
import { clampLimit, type ListOptions } from '../types.js';

export interface CreateAlertInput {
  warrantId: string;
  telegramConfigId: string;
}

export class AlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(tenantId: string, id: string): Promise<Alert | null> {
    return this.prisma.alert.findFirst({ where: { id, tenantId } });
  }

  /**
   * Idempotent enqueue: returns the existing row if (warrantId, telegramConfigId)
   * already exists in any non-final state, otherwise creates a PENDING alert.
   */
  enqueue(tenantId: string, input: CreateAlertInput): Promise<Alert> {
    return this.prisma.alert.upsert({
      where: {
        warrant_config_unique: {
          warrantId: input.warrantId,
          telegramConfigId: input.telegramConfigId,
        },
      },
      create: {
        tenantId,
        warrantId: input.warrantId,
        telegramConfigId: input.telegramConfigId,
      },
      update: {}, // no-op — idempotent
    });
  }

  listPending(opts: ListOptions = {}): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
  }

  listByTenant(tenantId: string, status?: AlertStatus, opts: ListOptions = {}): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
  }

  async markSent(id: string): Promise<void> {
    await this.prisma.alert.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.alert.update({
      where: { id },
      data: { status: 'FAILED', lastError: error, attempts: { increment: 1 } },
    });
  }

  async markSkipped(id: string, reason: string): Promise<void> {
    await this.prisma.alert.update({
      where: { id },
      data: { status: 'SKIPPED', lastError: reason },
    });
  }
}
