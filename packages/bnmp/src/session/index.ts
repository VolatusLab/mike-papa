import { CookieJar } from 'tough-cookie';
import type { Logger } from '@bnmp/logger';
import { BnmpRequestFailed } from '@bnmp/shared';
import { createHttpClient } from '../client/http.js';
import { generateFingerprint } from './fingerprint.js';
import { jwtExpired } from './jwt.js';
import { extractPortalCookie } from './cookie.js';

export interface SessionManagerOptions {
  baseUrl: string;
  userAgent: string;
  logger: Logger;
  /** how many sessions to keep warm; default 2 */
  poolSize?: number;
  /** seconds before JWT exp to consider session expired; default 60 */
  refreshSafetySeconds?: number;
  /** path used to bootstrap the guest cookie; default /api/dominio/estados */
  bootstrapPath?: string;
}

export interface AcquiredSession {
  readonly fingerprint: string;
  readonly cookieJar: CookieJar;
  readonly cookie: string;
  readonly acquiredAt: Date;
}

/**
 * Pool of anonymous BNMP sessions. Each session carries:
 *   - a tough-cookie jar holding the `portalbnmp` JWT issued by the portal
 *   - a 32-char hex fingerprint sent as the `fingerprint` header
 *
 * Acquire is round-robin. Sessions self-refresh when their JWT is near `exp`.
 * Call `refresh()` explicitly after a 401/403 (the client does this).
 */
export class BnmpSessionManager {
  private readonly pool: AcquiredSession[] = [];
  private cursor = 0;
  private readonly poolSize: number;
  private readonly refreshSafetySeconds: number;
  private readonly bootstrapPath: string;

  constructor(private readonly opts: SessionManagerOptions) {
    this.poolSize = Math.max(1, opts.poolSize ?? 2);
    this.refreshSafetySeconds = opts.refreshSafetySeconds ?? 60;
    this.bootstrapPath = opts.bootstrapPath ?? '/api/dominio/estados';
  }

  size(): number {
    return this.pool.length;
  }

  async acquire(): Promise<AcquiredSession> {
    const log = this.opts.logger.child({ module: 'bnmp-session' });

    // Grow pool up to poolSize lazily.
    if (this.pool.length < this.poolSize) {
      const session = await this.initSession();
      this.pool.push(session);
      log.info({ poolSize: this.pool.length }, 'session:created');
      return session;
    }

    // Round-robin pick.
    const idx = this.cursor % this.pool.length;
    this.cursor = (this.cursor + 1) % this.pool.length;
    const picked = this.pool[idx];
    if (!picked) throw new Error('session pool corruption — picked undefined');

    if (this.isExpired(picked)) {
      log.warn({ idx }, 'session:expired — auto-refresh');
      return this.refresh(picked);
    }
    return picked;
  }

  async refresh(session: AcquiredSession): Promise<AcquiredSession> {
    const log = this.opts.logger.child({ module: 'bnmp-session' });
    const idx = this.pool.indexOf(session);
    const fresh = await this.initSession(session.fingerprint);
    if (idx >= 0) this.pool[idx] = fresh;
    else this.pool.push(fresh);
    log.info({ idx }, 'session:refreshed');
    return fresh;
  }

  async invalidate(session: AcquiredSession): Promise<void> {
    const idx = this.pool.indexOf(session);
    if (idx >= 0) this.pool.splice(idx, 1);
  }

  private async initSession(reuseFingerprint?: string): Promise<AcquiredSession> {
    const fingerprint = reuseFingerprint ?? generateFingerprint();
    const jar = new CookieJar();
    const http = createHttpClient({
      baseUrl: this.opts.baseUrl,
      userAgent: this.opts.userAgent,
      fingerprint,
      cookieJar: jar,
      logger: this.opts.logger,
    });
    // Tiny anonymous-friendly call to receive the portalbnmp cookie.
    await http.get(this.bootstrapPath);
    const cookie = await extractPortalCookie(jar, this.opts.baseUrl);
    if (!cookie) {
      throw new BnmpRequestFailed('Bootstrap call did not return portalbnmp cookie', {
        context: { bootstrapPath: this.bootstrapPath },
      });
    }
    return { fingerprint, cookieJar: jar, cookie, acquiredAt: new Date() };
  }

  private isExpired(session: AcquiredSession): boolean {
    return jwtExpired(session.cookie, this.refreshSafetySeconds);
  }
}
