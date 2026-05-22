/**
 * Opt-in smoke against the real BNMP portal — no DB, no pg-boss.
 *
 * Usage:
 *   pnpm --filter @bnmp/worker smoke
 *
 * Env required:
 *   BNMP_BASE_URL (defaults to https://portalbnmp.cnj.jus.br/bnmpportal)
 *   BNMP_USER_AGENT
 *   BNMP_SMOKE_ID_ESTADO=27           (TO; default)
 *   BNMP_SMOKE_ID_MUNICIPIO=9655      (Palmeirópolis; default)
 *   BNMP_SMOKE_PAGES=1                (pages to print; default 1)
 *
 * Exits 0 on success, 1 on any error. Prints structured JSON.
 */
import { createLogger } from '@bnmp/logger';
import { BnmpClient, BnmpRateLimiter, BnmpSessionManager, type BnmpFilter } from '@bnmp/bnmp';

const env = {
  baseUrl: process.env.BNMP_BASE_URL ?? 'https://portalbnmp.cnj.jus.br/bnmpportal',
  userAgent: process.env.BNMP_USER_AGENT ?? 'bnmp-monitor-smoke/0.0 (+contact@example.com)',
  idEstado: Number(process.env.BNMP_SMOKE_ID_ESTADO ?? 27),
  idMunicipio: Number(process.env.BNMP_SMOKE_ID_MUNICIPIO ?? 9655),
  pages: Number(process.env.BNMP_SMOKE_PAGES ?? 1),
};

async function main(): Promise<void> {
  const logger = createLogger({ service: 'bnmp-smoke', level: 'info' });
  const log = logger.child({ phase: 'smoke' });

  log.info({ env }, 'smoke:starting');

  const sessionManager = new BnmpSessionManager({
    baseUrl: env.baseUrl,
    userAgent: env.userAgent,
    logger,
    poolSize: 1,
  });
  const rateLimiter = new BnmpRateLimiter({ rpm: 30, maxConcurrent: 2 });
  const client = new BnmpClient({
    baseUrl: env.baseUrl,
    userAgent: env.userAgent,
    logger,
    sessionManager,
    rateLimiter,
  });

  const filter: BnmpFilter = {
    buscaOrgaoRecursivo: true,
    idEstado: env.idEstado,
    idMunicipio: env.idMunicipio,
    idTipoPeca: 1,
    orgaoExpeditor: {},
  };

  try {
    for (let page = 0; page < env.pages; page++) {
      const result = await client.filterPage({ filter, page, size: 10 });
      log.info(
        {
          page,
          totalElements: result.totalElements,
          totalPages: result.totalPages,
          last: result.last,
          contentLength: result.content.length,
        },
        'smoke:page',
      );
      for (const w of result.content) {
        log.info(
          {
            id: w.id,
            nome: w.nomePessoa,
            status: w.descricaoStatus,
            dataExp: w.dataExpedicao,
            orgao: w.nomeOrgao,
          },
          'smoke:warrant',
        );
      }
      if (result.last) break;
    }
  } finally {
    await rateLimiter.stop();
  }

  log.info('smoke:done');
}

main().catch((err) => {
  console.error('[smoke] failed:', err);
  process.exit(1);
});
