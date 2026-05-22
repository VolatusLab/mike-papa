import {
  JobValidationFailed,
  TelegramConfigInvalid,
  TelegramSendFailed,
  JOB_NAMES,
} from '@bnmp/shared';
import type { JobHandler } from '@bnmp/queue';
import type { Warrant, WarrantChangeKind } from '@bnmp/db';
import { formatAlertMessage, type AlertKind, type AlertWarrantView } from '@bnmp/telegram';
import type { WorkerServices } from '../services/index.js';

/** HTTP statuses from Telegram that will never succeed on retry. */
function isPermanentTelegramError(err: unknown): boolean {
  if (err instanceof TelegramConfigInvalid) return true;
  if (!(err instanceof TelegramSendFailed)) return false;
  const ctx = err.context as { httpStatus?: number } | undefined;
  const s = ctx?.httpStatus;
  return s === 400 || s === 401 || s === 403 || s === 404;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toWarrantView(w: Warrant): AlertWarrantView {
  return {
    bnmpId: w.bnmpId,
    numeroPeca: w.numeroPeca,
    numeroPecaFormatado: w.numeroPecaFormatado,
    numeroProcesso: w.numeroProcesso,
    nomePessoa: w.nomePessoa,
    alcunha: w.alcunha,
    descricaoStatus: w.descricaoStatus,
    descricaoPeca: w.descricaoPeca,
    dataExpedicao: w.dataExpedicao,
    nomeOrgao: w.nomeOrgao,
    nomeMae: w.nomeMae,
    nomePai: w.nomePai,
    dataNascimento: w.dataNascimento,
    descricaoSexo: w.descricaoSexo,
  };
}

/**
 * Send one queued alert via Telegram.
 *
 * Status transitions:
 *   PENDING → SENT      on success
 *   PENDING → FAILED    on permanent error (4xx, invalid config) — job completes
 *   PENDING → (stays)   on transient error (429/5xx/network) — rethrow → pg-boss retries
 *   PENDING → SKIPPED   when config/warrant missing or config disabled
 *
 * Idempotent: a non-PENDING alert short-circuits (a duplicate job is a no-op).
 *
 * PDF: best-effort. After the text is delivered (and the alert marked SENT),
 * if the config opts in and the warrant has a stored PDF, we additionally
 * send it as a document. A PDF failure NEVER fails the alert.
 */
export function makeTelegramSendAlertHandler(
  services: WorkerServices,
): JobHandler<typeof JOB_NAMES.TELEGRAM_SEND_ALERT> {
  const { repos, telegram, storage } = services;

  return async (job, log) => {
    const { tenantId, alertId } = job.data;

    const alert = await repos.alert.findById(tenantId, alertId);
    if (!alert) {
      throw new JobValidationFailed(`Alert not found: ${alertId}`, { context: { tenantId } });
    }
    if (alert.status !== 'PENDING') {
      log.info({ status: alert.status }, 'alert:already-processed');
      return;
    }

    const config = await repos.telegramConfig.findDecrypted(tenantId, alert.telegramConfigId);
    if (!config) {
      await repos.alert.markSkipped(alertId, 'telegram config not found');
      log.warn('alert:skipped (config missing)');
      return;
    }
    if (!config.alertEnabled) {
      await repos.alert.markSkipped(alertId, 'telegram config disabled');
      log.info('alert:skipped (alerts disabled)');
      return;
    }

    const warrant = await repos.warrant.findById(tenantId, alert.warrantId);
    if (!warrant) {
      await repos.alert.markSkipped(alertId, 'warrant not found');
      log.warn('alert:skipped (warrant missing)');
      return;
    }

    const latestHistory = await repos.warrantHistory.findLatestForWarrant(
      tenantId,
      alert.warrantId,
    );
    const kind: AlertKind = (latestHistory?.kind as WarrantChangeKind | undefined) ?? 'CREATED';
    const diff = (latestHistory?.diff ?? undefined) as
      | Record<string, { from: unknown; to: unknown }>
      | undefined;

    const text = formatAlertMessage({ warrant: toWarrantView(warrant), kind, diff });

    try {
      await telegram.sendMessage({ botToken: config.botToken, chatId: config.chatId, text });
      await repos.alert.markSent(alertId);
      log.info({ kind, chatId: config.chatId }, 'alert:sent');
    } catch (err) {
      if (isPermanentTelegramError(err)) {
        await repos.alert.markFailed(alertId, errorMessage(err));
        await repos.workerLog.append({
          level: 'error',
          message: `Falha permanente ao enviar alerta: ${errorMessage(err)}`,
          tenantId,
          correlationId: job.data.correlationId,
          jobName: JOB_NAMES.TELEGRAM_SEND_ALERT,
          context: { alertId },
        });
        log.error({ err }, 'alert:failed-permanent');
        return; // job completes — no retry
      }
      log.warn({ err, retryHint: 'transient' }, 'alert:transient-failure');
      throw err; // pg-boss retries; alert stays PENDING
    }

    // Best-effort PDF attachment — never fails the (already-sent) alert.
    if (config.sendPdf && warrant.pdfAssetId) {
      try {
        const asset = await repos.pdfAsset.findById(tenantId, warrant.pdfAssetId);
        if (!asset) {
          log.warn({ pdfAssetId: warrant.pdfAssetId }, 'alert:pdf-asset-missing');
        } else {
          const bytes = await storage.download(asset.storagePath);
          await telegram.sendDocument({
            botToken: config.botToken,
            chatId: config.chatId,
            document: bytes,
            filename: `mandado-${warrant.bnmpId}.pdf`,
          });
          log.info({ pdfAssetId: asset.id }, 'alert:pdf-sent');
        }
      } catch (err) {
        log.warn({ err }, 'alert:pdf-send-failed (alert already delivered)');
      }
    }
  };
}
