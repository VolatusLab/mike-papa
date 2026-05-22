import type { AxiosInstance } from 'axios';
import type { Logger } from '@bnmp/logger';
import { BnmpSessionExpired } from '@bnmp/shared';
import type { BnmpFilter, BnmpPageParams } from '../types/index.js';
import {
  BnmpWarrantSchema,
  parseBnmpResponse,
  pagedSchema,
  type BnmpWarrant,
  type Paged,
} from '../parsers/index.js';
import type { AcquiredSession, BnmpSessionManager } from '../session/index.js';
import type { BnmpRateLimiter } from '../rate-limit/index.js';
import { downloadPdf, type DownloadedPdf, type DownloadPdfRequest } from '../pdf/index.js';
import { createHttpClient, requestWithRetry } from './http.js';

export interface BnmpClientOptions {
  baseUrl: string;
  userAgent: string;
  logger: Logger;
  sessionManager: BnmpSessionManager;
  rateLimiter: BnmpRateLimiter;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface FilterPageRequest extends BnmpPageParams {
  filter: BnmpFilter;
}

const DEFAULT_SORT = 'dataExpedicao,DESC';

/**
 * High-level BNMP API client. Composes the session pool, rate limiter, and HTTP
 * retry policy. Domain layers (worker handlers) should ONLY talk to this.
 *
 * Single 401/403 in the middle of a call triggers an explicit session refresh
 * and ONE retry — beyond that we propagate the error so backoff / DLQ kicks in.
 */
export class BnmpClient {
  constructor(private readonly opts: BnmpClientOptions) {}

  /** Single page of /api/pesquisa-pecas/filter results. */
  filterPage(req: FilterPageRequest): Promise<Paged<BnmpWarrant>> {
    return this.opts.rateLimiter.schedule(() => this.executeFilter(req));
  }

  /**
   * Lazy iteration across all pages — caller decides when to break (e.g. on
   * a known bnmpId). Each page goes through the rate limiter independently.
   */
  async *iterateAll(req: FilterPageRequest): AsyncGenerator<BnmpWarrant> {
    const size = req.size ?? 50;
    let page = req.page ?? 0;
    while (true) {
      const result = await this.filterPage({ ...req, page, size });
      for (const w of result.content) yield w;
      if (result.last) return;
      page += 1;
    }
  }

  /**
   * Download a warrant PDF. Goes through the rate limiter; refreshes the
   * session once on 401/403 then retries.
   */
  downloadPdf(req: DownloadPdfRequest): Promise<DownloadedPdf> {
    return this.opts.rateLimiter.schedule(() => this.executeDownload(req));
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async executeDownload(req: DownloadPdfRequest): Promise<DownloadedPdf> {
    const session = await this.opts.sessionManager.acquire();
    try {
      return await downloadPdf(this.buildHttp(session), req);
    } catch (err) {
      if (err instanceof BnmpSessionExpired) {
        const fresh = await this.opts.sessionManager.refresh(session);
        return downloadPdf(this.buildHttp(fresh), req);
      }
      throw err;
    }
  }

  private async executeFilter(req: FilterPageRequest): Promise<Paged<BnmpWarrant>> {
    const session = await this.opts.sessionManager.acquire();
    try {
      return await this.doFilter(session, req);
    } catch (err) {
      if (err instanceof BnmpSessionExpired) {
        const fresh = await this.opts.sessionManager.refresh(session);
        return this.doFilter(fresh, req);
      }
      throw err;
    }
  }

  private async doFilter(
    session: AcquiredSession,
    req: FilterPageRequest,
  ): Promise<Paged<BnmpWarrant>> {
    const http = this.buildHttp(session);
    const params = {
      page: req.page ?? 0,
      size: req.size ?? 10,
      sort: req.sort ?? DEFAULT_SORT,
    };
    const response = await requestWithRetry(
      () => http.post('/api/pesquisa-pecas/filter', req.filter, { params }),
      {
        maxAttempts: this.opts.maxRetries ?? 3,
        baseDelayMs: 500,
        logger: this.opts.logger,
      },
    );
    return parseBnmpResponse(pagedSchema(BnmpWarrantSchema), response.data, {
      endpoint: '/api/pesquisa-pecas/filter',
      page: params.page,
    });
  }

  private buildHttp(session: AcquiredSession): AxiosInstance {
    return createHttpClient({
      baseUrl: this.opts.baseUrl,
      userAgent: this.opts.userAgent,
      fingerprint: session.fingerprint,
      cookieJar: session.cookieJar,
      timeoutMs: this.opts.timeoutMs,
      logger: this.opts.logger,
    });
  }
}
