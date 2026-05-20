// Registry de nomes de jobs pg-boss.
// Centralizar aqui evita typos e drift entre produtor/consumidor.

export const JOB_NAMES = {
  BNMP_SCAN_CITY: 'bnmp.scan.city',
  BNMP_RETROACTIVE_SCAN: 'bnmp.retroactive.scan',
  WARRANT_RECHECK: 'warrant.recheck',
  PDF_DOWNLOAD: 'bnmp.download.pdf',
  TELEGRAM_SEND_ALERT: 'telegram.send.alert',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// Payload mínimo que todo job carrega.
export interface JobBaseMeta {
  tenantId: string;
  correlationId: string;
  enqueuedAt: string; // ISO-8601
}

export interface ScanCityPayload extends JobBaseMeta {
  monitoredCityId: string;
  page?: number;
  size?: number;
}

export interface RetroactiveScanPayload extends JobBaseMeta {
  monitoredCityId: string;
  fromPage: number;
  toPage: number;
}

export interface WarrantRecheckPayload extends JobBaseMeta {
  warrantId: string;
  bnmpId: number;
}

export interface PdfDownloadPayload extends JobBaseMeta {
  warrantId: string;
  bnmpId: number;
  tipo: number; // 1 = relatorio padrão
}

export interface TelegramAlertPayload extends JobBaseMeta {
  alertId: string;
}

export interface JobPayloads {
  [JOB_NAMES.BNMP_SCAN_CITY]: ScanCityPayload;
  [JOB_NAMES.BNMP_RETROACTIVE_SCAN]: RetroactiveScanPayload;
  [JOB_NAMES.WARRANT_RECHECK]: WarrantRecheckPayload;
  [JOB_NAMES.PDF_DOWNLOAD]: PdfDownloadPayload;
  [JOB_NAMES.TELEGRAM_SEND_ALERT]: TelegramAlertPayload;
}
