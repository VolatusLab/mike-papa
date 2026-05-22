import { createClient } from '@supabase/supabase-js';
import type { Logger } from '@bnmp/logger';
import type { WorkerEnv } from '@bnmp/shared';
import { StorageWriteFailed } from '@bnmp/shared';

export interface PdfStorage {
  /** Upload bytes (idempotent — upsert). Path is bucket-relative. */
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Download bytes. Throws StorageWriteFailed if missing. */
  download(path: string): Promise<Uint8Array>;
  /** Time-limited public URL (for the dashboard). */
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  /** Cheap existence probe (lists parent dir). */
  exists(path: string): Promise<boolean>;
}

/**
 * Supabase Storage wrapper for warrant PDFs. Uses the service-role key —
 * bypasses Storage RLS, so this MUST stay worker-only. The bucket is expected
 * to already exist (created during Supabase provisioning).
 */
export function createPdfStorage(env: WorkerEnv, logger: Logger): PdfStorage {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const log = logger.child({ module: 'pdf-storage', bucket });

  return {
    async upload(path, bytes, contentType) {
      const { error } = await client.storage.from(bucket).upload(path, bytes, {
        contentType,
        upsert: true,
      });
      if (error) {
        throw new StorageWriteFailed(`Upload failed: ${path}`, {
          cause: error,
          context: { path },
        });
      }
      log.info({ path, bytes: bytes.length }, 'storage:uploaded');
    },

    async download(path) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data) {
        throw new StorageWriteFailed(`Download failed: ${path}`, {
          cause: error,
          context: { path },
        });
      }
      return new Uint8Array(await data.arrayBuffer());
    },

    async getSignedUrl(path, expiresInSeconds = 3600) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (error || !data) {
        throw new StorageWriteFailed(`Signed URL failed: ${path}`, {
          cause: error,
          context: { path },
        });
      }
      return data.signedUrl;
    },

    async exists(path) {
      const slash = path.lastIndexOf('/');
      const dir = slash >= 0 ? path.slice(0, slash) : '';
      const name = slash >= 0 ? path.slice(slash + 1) : path;
      const { data } = await client.storage.from(bucket).list(dir, { search: name });
      return Boolean(data?.some((f) => f.name === name));
    },
  };
}
