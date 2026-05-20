import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Common
// ─────────────────────────────────────────────────────────────────────────────

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
const logLevelSchema = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info');

const url = z.string().url();
const nonEmpty = z.string().min(1);
const port = z.coerce.number().int().min(1).max(65535);

// AES-256-GCM key (32 bytes / 64 hex chars). Used to encrypt botToken/cookie/etc at rest.
const encryptionKey = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)');

// ─────────────────────────────────────────────────────────────────────────────
// Worker env
// ─────────────────────────────────────────────────────────────────────────────

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,

  // Postgres (pooled URL for Prisma + pg-boss)
  DATABASE_URL: url,
  DIRECT_URL: url.optional(),

  // pg-boss
  PGBOSS_SCHEMA: nonEmpty.default('pgboss'),

  // Supabase
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  SUPABASE_STORAGE_BUCKET: nonEmpty.default('bnmp-pdfs'),

  // BNMP
  BNMP_BASE_URL: url.default('https://portalbnmp.cnj.jus.br/bnmpportal'),
  BNMP_POLL_INTERVAL_CRON: nonEmpty.default('*/5 * * * *'),
  BNMP_RATE_LIMIT_RPM: z.coerce.number().int().positive().default(30),
  BNMP_USER_AGENT: nonEmpty.default('bnmp-monitor/0.0 (+contact@example.com)'),

  // Telegram (fallback bot — per-tenant overrides live in DB)
  TELEGRAM_BOT_TOKEN_DEFAULT: nonEmpty.optional(),

  // Health server
  WORKER_PORT: port.default(8080),

  // Crypto
  ENCRYPTION_KEY: encryptionKey,
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Web env
// ─────────────────────────────────────────────────────────────────────────────

export const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  LOG_LEVEL: logLevelSchema,

  // Postgres (Prisma uses pooled; migrations use DIRECT_URL)
  DATABASE_URL: url,
  DIRECT_URL: url.optional(),

  // Supabase — server-side
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,

  // Supabase — public (browser)
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,

  // Crypto (used by server actions/routes that touch encrypted columns)
  ENCRYPTION_KEY: encryptionKey,
});

export type WebEnv = z.infer<typeof webEnvSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse + fail fast. Use at process boot (worker entrypoint, next instrumentation).
 * Throws a single readable error listing every invalid env var.
 */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  raw: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
