// @bnmp/db — único ponto de acesso ao banco.
// REGRA: nenhuma chamada Prisma fora deste pacote.

export { createPrismaClient, getPrismaClient, type PrismaClient } from './client.js';
export { encryptSecret, decryptSecret } from './crypto.js';
export { clampLimit, MAX_LIMIT, DEFAULT_LIMIT, type ListOptions } from './types.js';
export * from './repositories/index.js';

// Re-export selected Prisma enums + types so consumers don't depend directly on @prisma/client.
export type {
  Tenant,
  User,
  MonitoredCity,
  Warrant,
  WarrantHistory,
  TelegramConfig,
  Alert,
  WorkerLog,
  BnmpSession,
  PdfAsset,
} from '@prisma/client';
export { Role, AlertStatus, WarrantChangeKind } from '@prisma/client';
