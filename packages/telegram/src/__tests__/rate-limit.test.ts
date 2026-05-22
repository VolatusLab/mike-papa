import { describe, expect, it } from 'vitest';
import { TelegramRateLimiterPool } from '../rate-limit.js';

describe('TelegramRateLimiterPool', () => {
  it('serializes calls per chat', async () => {
    const pool = new TelegramRateLimiterPool({ perChatPerSecond: 10, globalPerSecond: 100 });
    const order: string[] = [];

    await Promise.all([
      pool.schedule('chatA', async () => {
        order.push('A1-start');
        await new Promise((r) => setTimeout(r, 30));
        order.push('A1-end');
      }),
      pool.schedule('chatA', async () => {
        order.push('A2-start');
        await new Promise((r) => setTimeout(r, 30));
        order.push('A2-end');
      }),
    ]);

    // Per-chat maxConcurrent=1 → A1 must fully complete before A2 starts.
    expect(order).toEqual(['A1-start', 'A1-end', 'A2-start', 'A2-end']);
    await pool.stop();
  });

  it('allows parallelism across different chats', async () => {
    const pool = new TelegramRateLimiterPool({ perChatPerSecond: 10, globalPerSecond: 100 });
    const order: string[] = [];

    await Promise.all([
      pool.schedule('chatA', async () => {
        order.push('A-start');
        await new Promise((r) => setTimeout(r, 50));
        order.push('A-end');
      }),
      pool.schedule('chatB', async () => {
        order.push('B-start');
        await new Promise((r) => setTimeout(r, 50));
        order.push('B-end');
      }),
    ]);

    // Both should be in flight together — starts interleaved before any end.
    expect(order.slice(0, 2).sort()).toEqual(['A-start', 'B-start']);
    await pool.stop();
  });
});
