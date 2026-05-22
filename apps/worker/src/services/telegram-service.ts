import type { Logger } from '@bnmp/logger';
import { TelegramService } from '@bnmp/telegram';

/**
 * Process-wide Telegram service. One rate-limiter pool shared across every
 * tenant's bot. Boot once; stop on graceful shutdown.
 */
export function createTelegramService(logger: Logger): TelegramService {
  return new TelegramService({
    logger,
    rateLimit: {
      perChatPerSecond: 1,
      globalPerSecond: 25,
      maxConcurrent: 10,
    },
  });
}
