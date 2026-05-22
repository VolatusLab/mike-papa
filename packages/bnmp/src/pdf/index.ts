import { createHash } from 'node:crypto';
import type { AxiosInstance } from 'axios';
import { AxiosError } from 'axios';
import { BnmpSessionExpired, PdfDownloadFailed } from '@bnmp/shared';

export interface DownloadPdfRequest {
  bnmpId: number;
  /** BNMP report type; 1 = relatório padrão. */
  tipo?: number;
}

export interface DownloadedPdf {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
  sha256: string;
  sizeBytes: number;
}

const PDF_MAGIC = '%PDF';

/** True if the buffer starts with the PDF magic bytes. */
export function isPdfBytes(buf: Uint8Array): boolean {
  if (buf.length < 4) return false;
  return (
    buf[0] === 0x25 && // %
    buf[1] === 0x50 && // P
    buf[2] === 0x44 && // D
    buf[3] === 0x46 //   F
  );
}

/**
 * Extract a filename from a Content-Disposition header. Handles both the
 * RFC 5987 `filename*=UTF-8''...` form and the plain `filename="..."` form.
 */
export function parsePdfFilename(disposition: unknown): string | null {
  if (typeof disposition !== 'string') return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // fall through to plain form
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1]?.trim() ?? null;
}

/**
 * Download a warrant PDF: POST /api/certidaos/relatorio/{id}/{tipo}.
 * Response is application/octet-stream (raw PDF). Validates the PDF magic
 * bytes and computes a SHA-256 for dedup. The supplied axios instance MUST
 * already carry a valid session (cookie jar + fingerprint).
 *
 * Throws:
 *   - BnmpSessionExpired on 401/403 (caller should refresh + retry)
 *   - PdfDownloadFailed on any other failure / non-PDF payload
 */
export async function downloadPdf(
  http: AxiosInstance,
  req: DownloadPdfRequest,
): Promise<DownloadedPdf> {
  const tipo = req.tipo ?? 1;
  const path = `/api/certidaos/relatorio/${req.bnmpId}/${tipo}`;

  let response;
  try {
    response = await http.post<ArrayBuffer>(path, undefined, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 30_000,
    });
  } catch (err) {
    const msg = err instanceof AxiosError ? err.message : 'network error';
    throw new PdfDownloadFailed(`PDF request failed for bnmpId ${req.bnmpId}: ${msg}`, {
      cause: err,
      context: { bnmpId: req.bnmpId, tipo },
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw new BnmpSessionExpired('Session expired during PDF download', {
      context: { status: response.status, bnmpId: req.bnmpId },
    });
  }
  if (response.status >= 400) {
    throw new PdfDownloadFailed(`PDF download HTTP ${response.status} for bnmpId ${req.bnmpId}`, {
      context: { status: response.status, bnmpId: req.bnmpId, tipo },
    });
  }

  const buf = Buffer.from(response.data);
  if (buf.length === 0) {
    throw new PdfDownloadFailed(`Empty PDF body for bnmpId ${req.bnmpId}`, {
      context: { bnmpId: req.bnmpId },
    });
  }
  if (!isPdfBytes(buf)) {
    throw new PdfDownloadFailed(`Response is not a PDF for bnmpId ${req.bnmpId}`, {
      context: { bnmpId: req.bnmpId, head: buf.subarray(0, 16).toString('latin1') },
    });
  }

  const contentType = String(response.headers['content-type'] ?? 'application/pdf');
  const filename =
    parsePdfFilename(response.headers['content-disposition']) ?? `mandado-${req.bnmpId}.pdf`;
  const sha256 = createHash('sha256').update(buf).digest('hex');

  return {
    bytes: new Uint8Array(buf),
    contentType,
    filename,
    sha256,
    sizeBytes: buf.length,
  };
}

// Keep the magic constant referenced for callers that want it.
export { PDF_MAGIC };
