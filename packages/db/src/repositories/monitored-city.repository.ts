import type { MonitoredCity, PrismaClient } from '@prisma/client';
import { clampLimit, type ListOptions } from '../types.js';

export interface MonitoredCityUpsertInput {
  uf: string;
  idEstado: number;
  idMunicipio: number;
  nome: string;
  idTipoPeca?: number;
  idSexo?: number | null;
  ativo?: boolean;
}

export class MonitoredCityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(tenantId: string, id: string): Promise<MonitoredCity | null> {
    return this.prisma.monitoredCity.findFirst({ where: { id, tenantId } });
  }

  listActive(tenantId: string): Promise<MonitoredCity[]> {
    return this.prisma.monitoredCity.findMany({
      where: { tenantId, ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  /**
   * CROSS-TENANT — only callable from the worker (service-role connection
   * bypasses RLS). Used by the scan tick to fan out per-city jobs across all
   * tenants. Web app must NEVER call this.
   */
  listAllActive(): Promise<MonitoredCity[]> {
    return this.prisma.monitoredCity.findMany({
      where: { ativo: true },
      orderBy: [{ tenantId: 'asc' }, { nome: 'asc' }],
    });
  }

  list(tenantId: string, opts: ListOptions = {}): Promise<MonitoredCity[]> {
    return this.prisma.monitoredCity.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
  }

  count(tenantId: string): Promise<number> {
    return this.prisma.monitoredCity.count({ where: { tenantId } });
  }

  upsert(tenantId: string, input: MonitoredCityUpsertInput): Promise<MonitoredCity> {
    const idTipoPeca = input.idTipoPeca ?? 1;
    return this.prisma.monitoredCity.upsert({
      where: {
        tenant_city_tipo_unique: {
          tenantId,
          idEstado: input.idEstado,
          idMunicipio: input.idMunicipio,
          idTipoPeca,
        },
      },
      create: {
        tenantId,
        uf: input.uf,
        idEstado: input.idEstado,
        idMunicipio: input.idMunicipio,
        nome: input.nome,
        idTipoPeca,
        idSexo: input.idSexo ?? null,
        ativo: input.ativo ?? true,
      },
      update: {
        nome: input.nome,
        idSexo: input.idSexo ?? null,
        ativo: input.ativo ?? true,
      },
    });
  }

  /** Partial update by id (tenant-scoped). Returns false if no row matched. */
  async update(
    tenantId: string,
    id: string,
    data: Partial<Omit<MonitoredCityUpsertInput, 'idSexo'>> & { idSexo?: number | null },
  ): Promise<boolean> {
    const r = await this.prisma.monitoredCity.updateMany({
      where: { id, tenantId },
      data,
    });
    return r.count === 1;
  }

  async setActive(tenantId: string, id: string, ativo: boolean): Promise<boolean> {
    const r = await this.prisma.monitoredCity.updateMany({
      where: { id, tenantId },
      data: { ativo },
    });
    return r.count === 1;
  }

  async markScanned(tenantId: string, id: string): Promise<void> {
    await this.prisma.monitoredCity.updateMany({
      where: { id, tenantId },
      data: { lastScanAt: new Date() },
    });
  }

  async markRetroactiveScanned(tenantId: string, id: string): Promise<void> {
    await this.prisma.monitoredCity.updateMany({
      where: { id, tenantId },
      data: { lastRetroactiveAt: new Date() },
    });
  }
}
