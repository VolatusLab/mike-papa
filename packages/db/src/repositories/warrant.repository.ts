import type { PrismaClient, Warrant } from '@prisma/client';
import { clampLimit, type ListOptions } from '../types.js';

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
      where: {
        tenantId,
        ...(opts.status ? { descricaoStatus: opts.status } : {}),
        ...(opts.monitoredCityId ? { monitoredCityId: opts.monitoredCityId } : {}),
      },
      orderBy: { dataExpedicao: 'desc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
  }

  async attachPdfAsset(tenantId: string, warrantId: string, pdfAssetId: string): Promise<boolean> {
    const r = await this.prisma.warrant.updateMany({
      where: { id: warrantId, tenantId },
      data: { pdfAssetId },
    });
    return r.count === 1;
  }
}
