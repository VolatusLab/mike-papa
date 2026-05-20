import { randomUUID } from 'node:crypto';
import pino, { type Logger, type LoggerOptions } from 'pino';

const REDACT_PATHS = [
  'password',
  'token',
  'botToken',
  'apiKey',
  'authorization',
  'cookie',
  'Cookie',
  'fingerprint',
  '*.password',
  '*.token',
  '*.botToken',
  '*.apiKey',
  '*.authorization',
  '*.cookie',
  '*.Cookie',
  '*.fingerprint',
  '*.headers.authorization',
  '*.headers.cookie',
  '*.headers.Cookie',
  'config.headers.authorization',
  'config.headers.cookie',
  'config.headers.Cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

export interface CreateLoggerOptions {
  service: string;
  level?: string;
  env?: string;
  base?: Record<string, unknown>;
}

/**
 * Create root logger. Call once per process, then derive child loggers
 * via `.child({ correlationId, requestId, tenantId, jobId, ... })`.
 *
 * - prod / test: structured JSON to stdout
 * - dev: pretty-printed (requires `pino-pretty` installed as dev dep)
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const env = opts.env ?? process.env.NODE_ENV ?? 'development';
  const level = opts.level ?? process.env.LOG_LEVEL ?? 'info';
  const isDev = env === 'development';

  const options: LoggerOptions = {
    level,
    base: {
      service: opts.service,
      env,
      pid: process.pid,
      ...opts.base,
    },
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
      remove: false,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (isDev) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          singleLine: false,
          ignore: 'pid,hostname,env',
        },
      },
    });
  }

  return pino(options);
}

/**
 * Generate a correlation id for an inbound request / job / scheduled tick.
 * Use this at the boundary, then `.child({ correlationId })` for all downstream logs.
 */
export function newCorrelationId(): string {
  return randomUUID();
}

/**
 * Derive a child logger bound to a correlation/request id.
 * Returns the same logger if no ids are provided.
 */
export function withCorrelation(
  logger: Logger,
  ids: { correlationId?: string; requestId?: string; tenantId?: string; jobId?: string },
): Logger {
  const bindings: Record<string, string> = {};
  if (ids.correlationId) bindings.correlationId = ids.correlationId;
  if (ids.requestId) bindings.requestId = ids.requestId;
  if (ids.tenantId) bindings.tenantId = ids.tenantId;
  if (ids.jobId) bindings.jobId = ids.jobId;
  return Object.keys(bindings).length === 0 ? logger : logger.child(bindings);
}

export type { Logger } from 'pino';
