// Tipos públicos do pacote @bnmp/bnmp.
// IDs e enums vivem em @bnmp/shared/constants; aqui ficam os tipos derivados.

export type IsoDate = string; // YYYY-MM-DD
export type IsoDateTime = string; // YYYY-MM-DDTHH:mm:ss.sssZ

export interface BnmpFilter {
  buscaOrgaoRecursivo: boolean;
  idEstado: number;
  idMunicipio: number;
  idSexo?: number;
  idTipoPeca: number;
  orgaoExpeditor: Record<string, unknown>;
}

export interface BnmpPageParams {
  page?: number;
  size?: number;
  sort?: string; // e.g. "dataExpedicao,DESC"
}

export interface BnmpPagedResult<T> {
  content: T[];
  last: boolean;
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface BnmpSessionState {
  cookie: string;
  fingerprint: string;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime | null;
  healthy: boolean;
}
