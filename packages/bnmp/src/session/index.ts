// BNMPSessionManager — pool de sessões + cookie JWT guest + fingerprint.
// Implementação real na Etapa 5.

import type { BnmpSessionState } from '../types/index.js';

export interface SessionManagerOptions {
  poolSize?: number;
  refreshSafetyMs?: number;
}

export class BnmpSessionManager {
  constructor(_opts: SessionManagerOptions = {}) {
    // implementação real chega na Etapa 5
  }

  async acquire(): Promise<BnmpSessionState> {
    throw new Error('BnmpSessionManager.acquire not implemented yet');
  }

  async release(_session: BnmpSessionState): Promise<void> {
    throw new Error('BnmpSessionManager.release not implemented yet');
  }
}
