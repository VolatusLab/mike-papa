import type { PrismaClient, WarrantChangeKind, WarrantHistory } from '@prisma/client';
import { clampLimit, type ListOptions } from '../types.js';

export interface AppendWarrantHistoryInput {
  warrantId: string;
  kind: WarrantChangeKind;
  snapshot: unknown; // arbitrary JSON
  snapshotHash: string;
  diff?: unknown;
}

export class WarrantHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  append(tenantId: string, input: AppendWarrantHistoryInput): Promise<WarrantHistory> {
    return this.prisma.warrantHistory.create({
      data: {
        tenantId,
        warrantId: input.warrantId,
        kind: input.kind,
        snapshot: input.snapshot as object,
        snapshotHash: input.snapshotHash,
        diff: (input.diff ?? undefined) as object | undefined,
      },
    });
  }

  listForWarrant(
    tenantId: string,
    warrantId: string,
    opts: ListOptions = {},
  ): Promise<WarrantHistory[]> {
    return this.prisma.warrantHistory.findMany({
      where: { tenantId, warrantId },
      orderBy: { detectedAt: 'desc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
  }

  /** Most recent change for one warrant — used by the alert handler to label kind. */
  findLatestForWarrant(tenantId: string, warrantId: string): Promise<WarrantHistory | null> {
    return this.prisma.warrantHistory.findFirst({
      where: { tenantId, warrantId },
      orderBy: { detectedAt: 'desc' },
    });
  }
}
