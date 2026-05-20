// BNMPClient — implementação real na Etapa 5.
// Responsabilidades: requests autenticadas, paginação, retries, backoff, parsing.

export interface BnmpClientOptions {
  baseUrl: string;
  userAgent: string;
  timeoutMs?: number;
}

export class BnmpClient {
  constructor(_opts: BnmpClientOptions) {
    // implementação real chega na Etapa 5
  }
}
