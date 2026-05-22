// @bnmp/telegram — public barrel.

export { TelegramService } from './service.js';
export type { TelegramServiceOptions, SendMessageInput, SendDocumentInput } from './service.js';

export {
  formatAlertMessage,
  escapeMdV2,
  type AlertKind,
  type AlertWarrantView,
  type FormatAlertInput,
} from './format.js';

export { TelegramRateLimiterPool, type TelegramRateLimitOptions } from './rate-limit.js';
export { withTelegramRetry } from './retry.js';

export { BotApiClient } from './api/client.js';
export type { BotApiResponse, BotUser, BotMessage, ParseMode } from './api/types.js';
