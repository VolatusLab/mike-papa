// @bnmp/bnmp — barrel público.
// REGRA: não exportar DTOs cruas (dto/), parsers internos, nem utils.
// Consumidores devem importar somente o que está aqui.

export { BnmpClient } from './client/index.js';
export type { BnmpClientOptions } from './client/index.js';

export { BnmpSessionManager } from './session/index.js';
export type { SessionManagerOptions } from './session/index.js';

export type {
  IsoDate,
  IsoDateTime,
  BnmpFilter,
  BnmpPageParams,
  BnmpPagedResult,
  BnmpSessionState,
} from './types/index.js';
