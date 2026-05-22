// Registry de nomes de jobs pg-boss.
// Centralizar aqui evita typos e drift entre produtor/consumidor.

export const JOB_NAMES = {
  // Fanout ticks — scheduled via pg-boss cron; handler dispatches per-city jobs.
  BNMP_SCAN_TICK: 'bnmp.scan.tick',
  BNMP_RETROACTIVE_TICK: 'bnmp.retroactive.tick',
  // Per-city / per-warrant work units.
  BNMP_SCAN_CITY: 'bnmp.scan.city',
  BNMP_RETROACTIVE_SCAN: 'bnmp.retroactive.scan',
  WARRANT_RECHECK: 'warrant.recheck',
  PDF_DOWNLOAD: 'bnmp.download.pdf',
  TELEGRAM_SEND_ALERT: 'telegram.send.alert',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

// Payload mínimo que todo job carrega.
// `tenantId: 'system'` é convencional para tick handlers que orquestram cross-tenant.
export interface JobBaseMeta {
  tenantId: string;
  correlationId: string;
  enqueuedAt: string; // ISO-8601
}

export type TickPayload = JobBaseMeta;

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
  [JOB_NAMES.BNMP_SCAN_TICK]: TickPayload;
  [JOB_NAMES.BNMP_RETROACTIVE_TICK]: TickPayload;
  [JOB_NAMES.BNMP_SCAN_CITY]: ScanCityPayload;
  [JOB_NAMES.BNMP_RETROACTIVE_SCAN]: RetroactiveScanPayload;
  [JOB_NAMES.WARRANT_RECHECK]: WarrantRecheckPayload;
  [JOB_NAMES.PDF_DOWNLOAD]: PdfDownloadPayload;
  [JOB_NAMES.TELEGRAM_SEND_ALERT]: TelegramAlertPayload;
}
