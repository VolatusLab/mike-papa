import type PgBoss from 'pg-boss';
import type { Logger } from '@bnmp/logger';
import type { WorkerEnv } from '@bnmp/shared';
import {
  AlertRepository,
  BnmpSessionRepository,
  MonitoredCityRepository,
  PdfAssetRepository,
  TelegramConfigRepository,
  TenantRepository,
  UserRepository,
  WarrantHistoryRepository,
  WarrantRepository,
  WorkerLogRepository,
  createPrismaClient,
  type PrismaClient,
} from '@bnmp/db';
import type { TelegramService } from '@bnmp/telegram';
import { createBnmpService, type BnmpService } from './bnmp-service.js';
import { createTelegramService } from './telegram-service.js';
import { createPdfStorage, type PdfStorage } from './storage.js';

export interface WorkerServices {
  env: WorkerEnv;
  logger: Logger;
  boss: PgBoss;
  prisma: PrismaClient;
  bnmp: BnmpService;
  telegram: TelegramService;
  storage: PdfStorage;
  repos: {
    tenant: TenantRepository;
    user: UserRepository;
    monitoredCity: MonitoredCityRepository;
    warrant: WarrantRepository;
    warrantHistory: WarrantHistoryRepository;
    telegramConfig: TelegramConfigRepository;
    alert: AlertRepository;
    workerLog: WorkerLogRepository;
    bnmpSession: BnmpSessionRepository;
    pdfAsset: PdfAssetRepository;
  };
  stop(): Promise<void>;
}

/**
 * Construct every domain service the worker needs. Call once at boot.
 * Each handler receives this and reaches in for what it needs — keeps DI
 * explicit without a full container framework.
 */
export function buildServices(env: WorkerEnv, boss: PgBoss, logger: Logger): WorkerServices {
  const prisma = createPrismaClient();
  const bnmp = createBnmpService(env, logger);
  const telegram = createTelegramService(logger);
  const storage = createPdfStorage(env, logger);

  const repos = {
    tenant: new TenantRepository(prisma),
    user: new UserRepository(prisma),
    monitoredCity: new MonitoredCityRepository(prisma),
    warrant: new WarrantRepository(prisma),
    warrantHistory: new WarrantHistoryRepository(prisma),
    telegramConfig: new TelegramConfigRepository(prisma),
    alert: new AlertRepository(prisma),
    workerLog: new WorkerLogRepository(prisma),
    bnmpSession: new BnmpSessionRepository(prisma),
    pdfAsset: new PdfAssetRepository(prisma),
  } as const;

  return {
    env,
    logger,
    boss,
    prisma,
    bnmp,
    telegram,
    storage,
    repos,
    async stop() {
      await telegram.stop();
      await bnmp.stop();
      await prisma.$disconnect();
    },
  };
}
