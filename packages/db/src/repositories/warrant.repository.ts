import type { MonitoredCity, PrismaClient, Prisma, Warrant } from '@prisma/client';
import { clampLimit, type ListOptions } from '../types.js';

export type WarrantWithCity = Warrant & {
  monitoredCity: Pick<MonitoredCity, 'nome' | 'uf'>;
};

export interface StatusCount {
  status: string;
  count: number;
}

export interface WarrantUpsertInput {
  monitoredCityId: string;
  bnmpId: bigint;
  numeroPeca: string;
  numeroProcesso: string;
  numeroPecaFormatado: string;
  nomePessoa: string;
  alcunha?: string | null;
  descricaoStatus: string;
  dataExpedicao: Date;
  nomeOrgao: string;
  descricaoPeca: string;
  idTipoPeca: number;
  nomeMae?: string | null;
  nomePai?: string | null;
  descricaoSexo: string;
  descricaoProfissao?: string | null;
  dataNascimento?: Date | null;
  snapshotHash: string;
}

export interface ListWarrantsOptions extends ListOptions {
  status?: string;
  monitoredCityId?: string;
  /** case-insensitive substring match on nomePessoa */
  search?: string;
}

function whereClause(tenantId: string, opts: ListWarrantsOptions): Prisma.WarrantWhereInput {
  return {
    tenantId,
    ...(opts.status ? { descricaoStatus: opts.status } : {}),
    ...(opts.monitoredCityId ? { monitoredCityId: opts.monitoredCityId } : {}),
    ...(opts.search ? { nomePessoa: { contains: opts.search, mode: 'insensitive' as const } } : {}),
  };
}

export class WarrantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByBnmpId(tenantId: string, bnmpId: bigint): Promise<Warrant | null> {
    return this.prisma.warrant.findUnique({
      where: { tenant_bnmp_unique: { tenantId, bnmpId } },
    });
  }

  findById(tenantId: string, id: string): Promise<Warrant | null> {
    return this.prisma.warrant.findFirst({ where: { id, tenantId } });
  }

  upsert(tenantId: string, data: WarrantUpsertInput): Promise<Warrant> {
    const now = new Date();
    return this.prisma.warrant.upsert({
      where: { tenant_bnmp_unique: { tenantId, bnmpId: data.bnmpId } },
      create: { ...data, tenantId, firstSeenAt: now, lastSeenAt: now },
      update: { ...data, lastSeenAt: now },
    });
  }

  async markSeen(tenantId: string, bnmpId: bigint): Promise<void> {
    await this.prisma.warrant.updateMany({
      where: { tenantId, bnmpId },
      data: { lastSeenAt: new Date() },
    });
  }

  list(tenantId: string, opts: ListWarrantsOptions = {}): Promise<Warrant[]> {
    return this.prisma.warrant.findMany({
      where: whereClause(tenantId, opts),
      orderBy: { dataExpedicao: 'desc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
  }

  /** Same as list but joins the monitored city (nome + uf) — for the dashboard table. */
  listWithCity(tenantId: string, opts: ListWarrantsOptions = {}): Promise<WarrantWithCity[]> {
    return this.prisma.warrant.findMany({
      where: whereClause(tenantId, opts),
      orderBy: { dataExpedicao: 'desc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
      include: { monitoredCity: { select: { nome: true, uf: true } } },
    });
  }

  count(tenantId: string, opts: ListWarrantsOptions = {}): Promise<number> {
    return this.prisma.warrant.count({ where: whereClause(tenantId, opts) });
  }

  /** Warrant counts grouped by raw descricaoStatus — powers the analytics bars. */
  async countByStatus(tenantId: string): Promise<StatusCount[]> {
    const groups = await this.prisma.warrant.groupBy({
      by: ['descricaoStatus'],
      where: { tenantId },
      _count: { _all: true },
    });
    return groups
      .map((g) => ({ status: g.descricaoStatus, count: g._count._all }))
      .sort((a, b) => b.count - a.count);
  }

  async attachPdfAsset(tenantId: string, warrantId: string, pdfAssetId: string): Promise<boolean> {
    const r = await this.prisma.warrant.updateMany({
      where: { id: warrantId, tenantId },
      data: { pdfAssetId },
    });
    return r.count === 1;
  }
}
