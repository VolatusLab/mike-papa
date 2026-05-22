import 'server-only';
import {
  AlertRepository,
  InvitationRepository,
  MonitoredCityRepository,
  TelegramConfigRepository,
  TenantRepository,
  UserRepository,
  WarrantHistoryRepository,
  WarrantRepository,
  WorkerLogRepository,
  getPrismaClient,
} from '@bnmp/db';

// Single shared Prisma client + repository instances for the web app.
// Web pages/actions go through these — never touch PrismaClient directly.
const prisma = getPrismaClient();

export const repos = {
  tenant: new TenantRepository(prisma),
  user: new UserRepository(prisma),
  monitoredCity: new MonitoredCityRepository(prisma),
  warrant: new WarrantRepository(prisma),
  warrantHistory: new WarrantHistoryRepository(prisma),
  telegramConfig: new TelegramConfigRepository(prisma),
  alert: new AlertRepository(prisma),
  workerLog: new WorkerLogRepository(prisma),
  invitation: new InvitationRepository(prisma),
} as const;
