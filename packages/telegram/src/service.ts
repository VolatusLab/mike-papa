import type { Logger } from '@bnmp/logger';
import { BotApiClient } from './api/client.js';
import type { BotMessage, BotUser, ParseMode } from './api/types.js';
import { TelegramRateLimiterPool, type TelegramRateLimitOptions } from './rate-limit.js';
import { withTelegramRetry } from './retry.js';

export interface TelegramServiceOptions {
  logger: Logger;
  rateLimit?: TelegramRateLimitOptions;
  timeoutMs?: number;
  baseUrl?: string; // override for testing
}

export interface SendMessageInput {
  botToken: string;
  chatId: string;
  text: string;
  parseMode?: ParseMode;
  disablePreview?: boolean;
}

export interface SendDocumentInput {
  botToken: string;
  chatId: string;
  document: Uint8Array;
  filename: string;
  caption?: string;
  parseMode?: ParseMode;
}

/**
 * High-level Telegram outbound service.
 *
 * Stateless wrt bot tokens — every call carries its own. Internally maintains:
 *   - one global+per-chat rate limiter pool (shared across all bots)
 *   - per-call retry for short 429s and single 5xx
 *
 * Token is never logged; rate-limit keys by chatId.
 */
export class TelegramService {
  private readonly rateLimiter: TelegramRateLimiterPool;
  private readonly logger: Logger;
  private readonly timeoutMs: number;
  private readonly baseUrl?: string;

  constructor(opts: TelegramServiceOptions) {
    this.logger = opts.logger.child({ module: 'telegram' });
    this.rateLimiter = new TelegramRateLimiterPool(opts.rateLimit);
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.baseUrl = opts.baseUrl;
  }

  /** Quick liveness check — `getMe` returns the bot's own user record. */
  async testConnection(botToken: string): Promise<BotUser> {
    const client = this.client(botToken);
    return client.post<BotUser>('getMe', {});
  }

  async sendMessage(input: SendMessageInput): Promise<BotMessage> {
    const client = this.client(input.botToken);
    const payload: Record<string, unknown> = {
      chat_id: input.chatId,
      text: input.text,
      parse_mode: input.parseMode ?? 'MarkdownV2',
      disable_web_page_preview: input.disablePreview ?? true,
    };
    return this.rateLimiter.schedule(input.chatId, () =>
      withTelegramRetry(() => client.post<BotMessage>('sendMessage', payload), {
        logger: this.logger,
      }),
    );
  }

  async sendDocument(input: SendDocumentInput): Promise<BotMessage> {
    const client = this.client(input.botToken);
    const form = new FormData();
    form.append('chat_id', input.chatId);
    if (input.caption) {
      form.append('caption', input.caption);
      form.append('parse_mode', input.parseMode ?? 'MarkdownV2');
    }
    const blob = new Blob(
      [
        input.document.buffer.slice(
          input.document.byteOffset,
          input.document.byteOffset + input.document.byteLength,
        ) as ArrayBuffer,
      ],
      { type: 'application/pdf' },
    );
    form.append('document', blob, input.filename);

    return this.rateLimiter.schedule(input.chatId, () =>
      withTelegramRetry(() => client.postForm<BotMessage>('sendDocument', form), {
        logger: this.logger,
      }),
    );
  }

  async stop(): Promise<void> {
    await this.rateLimiter.stop();
  }

  private client(botToken: string): BotApiClient {
    return new BotApiClient({
      botToken,
      logger: this.logger,
      timeoutMs: this.timeoutMs,
      baseUrl: this.baseUrl,
    });
  }
}
