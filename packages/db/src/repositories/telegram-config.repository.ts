import type { PrismaClient, TelegramConfig } from '@prisma/client';
import { decryptSecret, encryptSecret } from '../crypto.js';

export interface UpsertTelegramConfigInput {
  userId: string;
  label?: string;
  /** Plaintext bot token — encrypted before persistence. */
  botToken: string;
  chatId: string;
  alertEnabled?: boolean;
  sendPdf?: boolean;
}

export interface DecryptedTelegramConfig extends Omit<TelegramConfig, 'botTokenEnc'> {
  botToken: string;
}

export class TelegramConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(tenantId: string, id: string): Promise<TelegramConfig | null> {
    return this.prisma.telegramConfig.findFirst({ where: { id, tenantId } });
  }

  listActiveByTenant(tenantId: string): Promise<TelegramConfig[]> {
    return this.prisma.telegramConfig.findMany({
      where: { tenantId, alertEnabled: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Returns config with bot token decrypted in memory. Never log this object. */
  async findDecrypted(tenantId: string, id: string): Promise<DecryptedTelegramConfig | null> {
    const row = await this.findById(tenantId, id);
    if (!row) return null;
    const { botTokenEnc, ...rest } = row;
    return { ...rest, botToken: decryptSecret(botTokenEnc) };
  }

  upsert(tenantId: string, input: UpsertTelegramConfigInput): Promise<TelegramConfig> {
    const label = input.label ?? 'default';
    const botTokenEnc = encryptSecret(input.botToken);
    return this.prisma.telegramConfig.upsert({
      where: { user_label_unique: { userId: input.userId, label } },
      create: {
        tenantId,
        userId: input.userId,
        label,
        botTokenEnc,
        chatId: input.chatId,
        alertEnabled: input.alertEnabled ?? true,
        sendPdf: input.sendPdf ?? true,
      },
      update: {
        botTokenEnc,
        chatId: input.chatId,
        alertEnabled: input.alertEnabled ?? true,
        sendPdf: input.sendPdf ?? true,
      },
    });
  }

  async setEnabled(tenantId: string, id: string, enabled: boolean): Promise<void> {
    await this.prisma.telegramConfig.updateMany({
      where: { id, tenantId },
      data: { alertEnabled: enabled },
    });
  }
}
