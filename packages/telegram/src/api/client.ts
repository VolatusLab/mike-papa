import axios, { type AxiosError, type AxiosInstance } from 'axios';
import type { Logger } from '@bnmp/logger';
import { TelegramConfigInvalid, TelegramSendFailed } from '@bnmp/shared';
import type { BotApiResponse } from './types.js';

export interface BotApiClientOptions {
  botToken: string;
  logger: Logger;
  timeoutMs?: number;
  baseUrl?: string;
}

/**
 * Lightweight Bot API HTTP wrapper. Stateless — instantiated per call (cheap).
 *
 * Why not telegraf/node-telegram-bot-api: we only send (no polling, no webhooks)
 * and we want explicit control over retry / rate-limit semantics integrated with
 * our pg-boss queue. Telegraf would also pull a large dependency surface.
 */
export class BotApiClient {
  private readonly http: AxiosInstance;
  private readonly logger: Logger;

  constructor(opts: BotApiClientOptions) {
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(opts.botToken)) {
      throw new TelegramConfigInvalid('Bot token format invalid');
    }
    const baseURL = `${opts.baseUrl ?? 'https://api.telegram.org'}/bot${opts.botToken}`;
    this.http = axios.create({
      baseURL,
      timeout: opts.timeoutMs ?? 15_000,
      validateStatus: () => true, // we read body for error_code regardless
    });
    this.logger = opts.logger.child({ module: 'telegram-api' });
  }

  /**
   * POST a JSON payload. Throws TelegramSendFailed on !ok with the error code,
   * description, and (if present) retry_after attached to context so the caller
   * can decide whether to retry-in-process vs requeue via pg-boss.
   */
  async post<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    let response;
    try {
      response = await this.http.post<BotApiResponse<T>>(`/${method}`, payload);
    } catch (err) {
      const axiosErr = err as AxiosError;
      throw new TelegramSendFailed(`Network error calling ${method}`, {
        cause: err,
        context: { method, message: axiosErr.message },
      });
    }
    return this.handle(method, response.status, response.data);
  }

  /**
   * POST a multipart form. Used for sendDocument with binary PDF bytes.
   * Caller builds the FormData (browser-native, available in Node 18+).
   */
  async postForm<T>(method: string, form: FormData): Promise<T> {
    let response;
    try {
      response = await this.http.post<BotApiResponse<T>>(`/${method}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
    } catch (err) {
      const axiosErr = err as AxiosError;
      throw new TelegramSendFailed(`Network error calling ${method}`, {
        cause: err,
        context: { method, message: axiosErr.message },
      });
    }
    return this.handle(method, response.status, response.data);
  }

  private handle<T>(method: string, httpStatus: number, body: BotApiResponse<T>): T {
    if (body.ok && body.result !== undefined) return body.result;

    const retryAfter = body.parameters?.retry_after;
    const description = body.description ?? `HTTP ${httpStatus}`;
    this.logger.warn(
      { method, httpStatus, error_code: body.error_code, retryAfter },
      'telegram:error',
    );

    throw new TelegramSendFailed(`Telegram ${method} failed: ${description}`, {
      context: {
        method,
        httpStatus,
        errorCode: body.error_code,
        description,
        retryAfter,
      },
    });
  }
}
