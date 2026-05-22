import type { Logger } from '@bnmp/logger';
import type PgBoss from 'pg-boss';
import {
  type AlertRepository,
  type MonitoredCityRepository,
  type PrismaClient,
  type TelegramConfigRepository,
  type Warrant,
  type WarrantHistoryRepository,
  type WarrantRepository,
  type WarrantUpsertInput,
  WarrantChangeKind,
} from '@bnmp/db';
import type { BnmpWarrant } from '@bnmp/bnmp';
import { canonicalizeStatus, parseIsoDate, snapshotHash } from '@bnmp/bnmp';
import { JOB_NAMES, type PdfDownloadPayload, type TelegramAlertPayload } from '@bnmp/shared';
import { publishJob, publishSingletonJob } from '@bnmp/queue';

export interface WarrantSyncDeps {
  prisma: PrismaClient;
  warrantRepo: WarrantRepository;
  warrantHistoryRepo: WarrantHistoryRepository;
  telegramConfigRepo: TelegramConfigRepository;
  alertRepo: AlertRepository;
  monitoredCityRepo: MonitoredCityRepository;
  boss: PgBoss;
  logger: Logger;
}

export interface SyncContext {
  tenantId: string;
  monitoredCityId: string;
  correlationId: string;
}

export interface SyncResult {
  bnmpId: bigint;
  outcome: 'created' | 'updated' | 'unchanged';
  changeKind?: WarrantChangeKind;
}

/**
 * Convert a wire-format BnmpWarrant into the canonical upsert input.
 * Status is preserved verbatim (display); change-detection uses snapshotHash.
 */
function toUpsertInput(
  monitoredCityId: string,
  raw: BnmpWarrant,
  hash: string,
): WarrantUpsertInput {
  const dataExp = parseIsoDate(raw.dataExpedicao);
  if (!dataExp) {
    throw new Error(`Invalid dataExpedicao for bnmpId ${raw.id}: ${raw.dataExpedicao}`);
  }
  return {
    monitoredCityId,
    bnmpId: BigInt(raw.id),
    numeroPeca: raw.numeroPeca,
    numeroProcesso: raw.numeroProcesso,
    numeroPecaFormatado: raw.numeroPecaFormatado,
    nomePessoa: raw.nomePessoa,
    alcunha: raw.alcunha,
    descricaoStatus: raw.descricaoStatus,
    dataExpedicao: dataExp,
    nomeOrgao: raw.nomeOrgao,
    descricaoPeca: raw.descricaoPeca,
    idTipoPeca: raw.idTipoPeca,
    nomeMae: raw.nomeMae,
    nomePai: raw.nomePai,
    descricaoSexo: raw.descricaoSexo,
    descricaoProfissao: raw.descricaoProfissao,
    dataNascimento: parseIsoDate(raw.dataNascimento ?? null),
    snapshotHash: hash,
  };
}

/**
 * Determine the change kind by comparing the previous warrant row to the
 * incoming raw payload. Used to label WarrantHistory rows meaningfully and
 * to decide whether to push a status-change alert.
 */
function detectChangeKind(prev: Warrant, incoming: BnmpWarrant): WarrantChangeKind {
  if (prev.descricaoStatus !== incoming.descricaoStatus) {
    const prevCanon = canonicalizeStatus(prev.descricaoStatus);
    const incCanon = canonicalizeStatus(incoming.descricaoStatus);
    if (incCanon === 'REVOGADO' && prevCanon !== 'REVOGADO') return WarrantChangeKind.REVOKED;
    if (prevCanon !== incCanon) return WarrantChangeKind.STATUS_CHANGED;
  }
  return WarrantChangeKind.UPDATED;
}

/**
 * Upsert one BNMP warrant + append history if changed + enqueue follow-up
 * jobs (PDF download, Telegram alerts) when something new or changed.
 *
 * Idempotent. Safe to call repeatedly with the same payload — unchanged rows
 * only bump lastSeenAt.
 */
export async function syncWarrant(
  deps: WarrantSyncDeps,
  ctx: SyncContext,
  raw: BnmpWarrant,
): Promise<SyncResult> {
  const log = deps.logger.child({
    module: 'warrant-sync',
    correlationId: ctx.correlationId,
    tenantId: ctx.tenantId,
    bnmpId: raw.id,
  });

  const hash = snapshotHash(raw);
  const existing = await deps.warrantRepo.findByBnmpId(ctx.tenantId, BigInt(raw.id));

  if (!existing) {
    const warrant = await deps.warrantRepo.upsert(
      ctx.tenantId,
      toUpsertInput(ctx.monitoredCityId, raw, hash),
    );
    await deps.warrantHistoryRepo.append(ctx.tenantId, {
      warrantId: warrant.id,
      kind: WarrantChangeKind.CREATED,
      snapshot: raw,
      snapshotHash: hash,
    });
    log.info('warrant:created');
    await enqueueFollowups(deps, ctx, warrant, /* notify */ true);
    return { bnmpId: warrant.bnmpId, outcome: 'created', changeKind: WarrantChangeKind.CREATED };
  }

  if (existing.snapshotHash === hash) {
    await deps.warrantRepo.markSeen(ctx.tenantId, BigInt(raw.id));
    return { bnmpId: existing.bnmpId, outcome: 'unchanged' };
  }

  const kind = detectChangeKind(existing, raw);
  const warrant = await deps.warrantRepo.upsert(
    ctx.tenantId,
    toUpsertInput(ctx.monitoredCityId, raw, hash),
  );
  await deps.warrantHistoryRepo.append(ctx.tenantId, {
    warrantId: warrant.id,
    kind,
    snapshot: raw,
    snapshotHash: hash,
    diff: diffSummary(existing, raw),
  });
  log.info({ kind }, 'warrant:updated');
  await enqueueFollowups(deps, ctx, warrant, /* notify */ true);
  return { bnmpId: warrant.bnmpId, outcome: 'updated', changeKind: kind };
}

function diffSummary(
  prev: Warrant,
  incoming: BnmpWarrant,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  if (prev.descricaoStatus !== incoming.descricaoStatus) {
    out.descricaoStatus = { from: prev.descricaoStatus, to: incoming.descricaoStatus };
  }
  if (prev.nomeOrgao !== incoming.nomeOrgao) {
    out.nomeOrgao = { from: prev.nomeOrgao, to: incoming.nomeOrgao };
  }
  if (prev.numeroPecaFormatado !== incoming.numeroPecaFormatado) {
    out.numeroPecaFormatado = { from: prev.numeroPecaFormatado, to: incoming.numeroPecaFormatado };
  }
  return out;
}

async function enqueueFollowups(
  deps: WarrantSyncDeps,
  ctx: SyncContext,
  warrant: Warrant,
  notify: boolean,
): Promise<void> {
  // 1. PDF download — singleton per warrant to dedupe in-flight.
  const pdfPayload: PdfDownloadPayload = {
    tenantId: ctx.tenantId,
    correlationId: ctx.correlationId,
    enqueuedAt: new Date().toISOString(),
    warrantId: warrant.id,
    bnmpId: Number(warrant.bnmpId),
    tipo: 1,
  };
  await publishSingletonJob(deps.boss, JOB_NAMES.PDF_DOWNLOAD, pdfPayload, `pdf:${warrant.id}`);

  // 2. Alerts — one per active TelegramConfig.
  if (!notify) return;
  const configs = await deps.telegramConfigRepo.listActiveByTenant(ctx.tenantId);
  for (const cfg of configs) {
    const alert = await deps.alertRepo.enqueue(ctx.tenantId, {
      warrantId: warrant.id,
      telegramConfigId: cfg.id,
    });
    if (alert.status !== 'PENDING') continue; // already sent / failed-and-skipped
    const payload: TelegramAlertPayload = {
      tenantId: ctx.tenantId,
      correlationId: ctx.correlationId,
      enqueuedAt: new Date().toISOString(),
      alertId: alert.id,
    };
    await publishJob(deps.boss, JOB_NAMES.TELEGRAM_SEND_ALERT, payload);
  }
}
