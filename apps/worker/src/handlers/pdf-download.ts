import { JobValidationFailed, type JOB_NAMES } from '@bnmp/shared';
import type { JobHandler } from '@bnmp/queue';
import type { WorkerServices } from '../services/index.js';

/** Storage path scheme — dedup-friendly: same SHA256 → same object. */
function storagePathFor(tenantId: string, sha256: string): string {
  return `${tenantId}/${sha256}.pdf`;
}

/**
 * Download a warrant PDF, dedup by SHA-256, persist to Supabase Storage,
 * record a PdfAsset row and attach it to the warrant.
 *
 * Flow:
 *   1. Warrant already has pdfAssetId → skip (idempotent).
 *   2. Download bytes (BnmpClient handles session/rate-limit/refresh).
 *   3. SHA-256 dedup:
 *        - hit  → attach existing PdfAsset (no re-upload).
 *        - miss → upload to Storage, upsert PdfAsset, attach.
 *
 * Retryable: download/storage failures throw → pg-boss retries with backoff.
 */
export function makePdfDownloadHandler(
  services: WorkerServices,
): JobHandler<typeof JOB_NAMES.PDF_DOWNLOAD> {
  const { repos, bnmp, storage } = services;

  return async (job, log) => {
    const { tenantId, warrantId, bnmpId, tipo } = job.data;

    const warrant = await repos.warrant.findById(tenantId, warrantId);
    if (!warrant) {
      throw new JobValidationFailed(`Warrant not found: ${warrantId}`, { context: { tenantId } });
    }
    if (warrant.pdfAssetId) {
      log.info('pdf:already-attached');
      return;
    }

    const pdf = await bnmp.client.downloadPdf({ bnmpId, tipo: tipo ?? 1 });
    log.info({ sha256: pdf.sha256, bytes: pdf.sizeBytes }, 'pdf:downloaded');

    // Dedup — same file may back many warrants (BNMP recycles documents).
    const existing = await repos.pdfAsset.findBySha(tenantId, pdf.sha256);
    if (existing) {
      await repos.warrant.attachPdfAsset(tenantId, warrantId, existing.id);
      log.info({ sha256: pdf.sha256, pdfAssetId: existing.id }, 'pdf:dedup-hit');
      return;
    }

    const path = storagePathFor(tenantId, pdf.sha256);
    await storage.upload(path, pdf.bytes, pdf.contentType);

    const asset = await repos.pdfAsset.upsert(tenantId, {
      sha256: pdf.sha256,
      storagePath: path,
      sizeBytes: pdf.sizeBytes,
      contentType: pdf.contentType,
      bnmpId: BigInt(bnmpId),
      tipo: tipo ?? 1,
    });
    await repos.warrant.attachPdfAsset(tenantId, warrantId, asset.id);

    log.info({ sha256: pdf.sha256, pdfAssetId: asset.id, path }, 'pdf:stored');
  };
}
