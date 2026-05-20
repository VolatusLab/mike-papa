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

  list(tenantId: string, opts: ListOptions = {}): Promise<MonitoredCity[]> {
    return this.prisma.monitoredCity.findMany({
      where: { tenantId },
      orderBy: { nome: 'asc' },
      take: clampLimit(opts.limit),
      skip: opts.offset ?? 0,
    });
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
