// Classes de erro tipadas. Nunca usar `throw new Error('string')` em código de domínio.

export abstract class AppError extends Error {
  abstract readonly code: string;
  override readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(message: string, opts?: { cause?: unknown; context?: Record<string, unknown> }) {
    super(message);
    this.name = this.constructor.name;
    this.cause = opts?.cause;
    this.context = opts?.context;
  }
}

// ─── BNMP integration ───────────────────────────────────────────────────────

export class BnmpSessionExpired extends AppError {
  readonly code = 'BNMP_SESSION_EXPIRED';
}

export class BnmpRateLimited extends AppError {
  readonly code = 'BNMP_RATE_LIMITED';
}

export class BnmpRequestFailed extends AppError {
  readonly code = 'BNMP_REQUEST_FAILED';
}

export class BnmpResponseInvalid extends AppError {
  readonly code = 'BNMP_RESPONSE_INVALID';
}

export class PdfDownloadFailed extends AppError {
  readonly code = 'PDF_DOWNLOAD_FAILED';
}

// ─── Telegram ────────────────────────────────────────────────────────────────

export class TelegramSendFailed extends AppError {
  readonly code = 'TELEGRAM_SEND_FAILED';
}

export class TelegramConfigInvalid extends AppError {
  readonly code = 'TELEGRAM_CONFIG_INVALID';
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export class JobValidationFailed extends AppError {
  readonly code = 'JOB_VALIDATION_FAILED';
}

export class JobPermanentFailure extends AppError {
  readonly code = 'JOB_PERMANENT_FAILURE';
}

// ─── Auth / Multi-tenant ─────────────────────────────────────────────────────

export class Unauthorized extends AppError {
  readonly code = 'UNAUTHORIZED';
}

export class Forbidden extends AppError {
  readonly code = 'FORBIDDEN';
}

export class TenantMismatch extends AppError {
  readonly code = 'TENANT_MISMATCH';
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export class StorageWriteFailed extends AppError {
  readonly code = 'STORAGE_WRITE_FAILED';
}
