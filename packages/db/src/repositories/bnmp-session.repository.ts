import type { BnmpSession, PrismaClient } from '@prisma/client';
import { decryptSecret, encryptSecret } from '../crypto.js';

export interface CreateBnmpSessionInput {
  cookie: string; // plaintext — encrypted before persistence
  fingerprint: string;
  userAgent: string;
  expiresAt?: Date | null;
}

export interface DecryptedBnmpSession extends Omit<BnmpSession, 'cookieEnc'> {
  cookie: string;
}

export class BnmpSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateBnmpSessionInput): Promise<BnmpSession> {
    return this.prisma.bnmpSession.create({
      data: {
        cookieEnc: encryptSecret(input.cookie),
        fingerprint: input.fingerprint,
        userAgent: input.userAgent,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  /** Oldest healthy session, preferring least recently used. */
  async pickLeastRecentlyUsed(): Promise<DecryptedBnmpSession | null> {
    const row = await this.prisma.bnmpSession.findFirst({
      where: { healthy: true },
      orderBy: [{ lastUsedAt: { sort: 'asc', nulls: 'first' } }],
    });
    if (!row) return null;
    const { cookieEnc, ...rest } = row;
    return { ...rest, cookie: decryptSecret(cookieEnc) };
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.bnmpSession.update({
      where: { id },
      data: { lastUsedAt: new Date(), acquiredCount: { increment: 1 } },
    });
  }

  async markUnhealthy(id: string): Promise<void> {
    await this.prisma.bnmpSession.update({
      where: { id },
      data: { healthy: false },
    });
  }

  async deleteExpired(): Promise<number> {
    const r = await this.prisma.bnmpSession.deleteMany({
      where: {
        OR: [{ healthy: false }, { expiresAt: { lt: new Date() } }],
      },
    });
    return r.count;
  }
}
