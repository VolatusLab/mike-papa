import Bottleneck from 'bottleneck';

export interface TelegramRateLimitOptions {
  /** Per-chat rate (msgs/sec). Default 1 (Telegram allows ~1/sec for groups). */
  perChatPerSecond?: number;
  /** Global cap (msgs/sec). Telegram allows ~30 globally. Default 25 for safety. */
  globalPerSecond?: number;
  /** Max concurrent in-flight calls across all chats. */
  maxConcurrent?: number;
}

/**
 * Pool of per-chat Bottleneck limiters + one global limiter chained on top.
 * Lazily creates per-chat limiters on first use; retains them indefinitely
 * (memory bounded by active chat count — typically small).
 */
export class TelegramRateLimiterPool {
  private readonly perChatBaseline: number;
  private readonly global: Bottleneck;
  private readonly chats = new Map<string, Bottleneck>();

  constructor(opts: TelegramRateLimitOptions = {}) {
    const perChat = opts.perChatPerSecond ?? 1;
    const globalPerSec = opts.globalPerSecond ?? 25;
    this.perChatBaseline = perChat;
    this.global = new Bottleneck({
      reservoir: globalPerSec,
      reservoirRefreshAmount: globalPerSec,
      reservoirRefreshInterval: 1_000,
      maxConcurrent: opts.maxConcurrent ?? 10,
      minTime: Math.ceil(1_000 / globalPerSec),
    });
  }

  /** Run `task` under both the per-chat and global limiters. */
  async schedule<T>(chatId: string, task: () => Promise<T>): Promise<T> {
    const chat = this.getChatLimiter(chatId);
    return chat.schedule(() => this.global.schedule(task));
  }

  private getChatLimiter(chatId: string): Bottleneck {
    let l = this.chats.get(chatId);
    if (!l) {
      l = new Bottleneck({
        reservoir: this.perChatBaseline,
        reservoirRefreshAmount: this.perChatBaseline,
        reservoirRefreshInterval: 1_000,
        maxConcurrent: 1,
        minTime: Math.ceil(1_000 / this.perChatBaseline),
      });
      this.chats.set(chatId, l);
    }
    return l;
  }

  async stop(): Promise<void> {
    await Promise.all([
      this.global.stop({ dropWaitingJobs: false }),
      ...Array.from(this.chats.values()).map((l) => l.stop({ dropWaitingJobs: false })),
    ]);
    this.chats.clear();
  }
}
