# CLAUDE.md — operational memory

> Read this first. Token-optimized; do not expand without reason.

## 1. Visão

SaaS multi-tenant que monitora o portal BNMP (CNJ) e dispara alertas Telegram.
Stack: pnpm + Turborepo monorepo · Next.js 15 (Vercel) · Node worker (Docker) · Supabase Postgres + Auth + Storage · Prisma · pg-boss · pino.

## 2. Regras fixas (não re-discutir)

- Web na Vercel. Worker NÃO na Vercel.
- Banco: Supabase Postgres. Acesso só via Prisma (`packages/db`).
- Filas/jobs/cron: **pg-boss** (no mesmo Postgres). NÃO usar Redis/BullMQ.
- Integração BNMP: HTTP puro. NÃO usar Playwright/Selenium.
- Auth: Supabase Auth. RBAC: ADMIN / MODERATOR / USER.
- PDFs: Supabase Storage; dedupe por SHA256.
- Dedupe BNMP por campo `id` da resposta.
- Polling retroativo obrigatório (não confiar só em `dataExpedicao`).
- Clean Architecture: worker orquestra, lógica vive em packages.
- Multi-tenant: TODA query carrega `tenantId`. RLS no Supabase.

## 3. Estrutura

```
apps/web        Next.js 15 App Router (Vercel)
apps/worker     orchestrator — registra handlers, health, shutdown
packages/shared schemas zod, env, errors, constants (BNMP enums, JOB_NAMES)
packages/db     Prisma client + repositories (acesso ao banco SOMENTE aqui)
packages/bnmp   client/, session/, parsers/, pdf/, rate-limit/, normalizers/, dto/, types/, utils/
packages/queue  pg-boss wrapper: startBoss, registerWorker, publishJob, scheduleCron
packages/telegram  TelegramService (sendMessage, sendDocument)
packages/logger pino: createLogger, newCorrelationId, withCorrelation
infra/docker    Dockerfile.worker + docker-compose.yml
prisma          schema canônico
```

## 4. Convenções

- Imports cross-package: `@bnmp/{shared,db,bnmp,queue,telegram,logger}`.
- Validação: TODO input externo (env, BNMP, body) → zod schema em `packages/shared`.
- Erros: classes em `@bnmp/shared/errors` (`BnmpSessionExpired`, `BnmpRateLimited`, `JobPermanentFailure`, …). Nunca `throw new Error('string')`.
- Logs: `logger.info({ ctx }, 'msg')`. Nunca `console.log`. Sempre child logger com `correlationId` no boundary.
- DB: apenas via `packages/db/src/repositories/*`. Nunca importar PrismaClient fora desse pacote.
- Secrets (botToken, cookie BNMP, service role key): redactados no logger, criptografados em DB (AES-256-GCM, `ENCRYPTION_KEY`).
- Jobs: nome SEMPRE de `JOB_NAMES`; payload tipado via `JobPayloads[N]`.
- Worker = orquestração. NÃO inline lógica BNMP/Telegram/PDF — viva em packages.

## 5. Disciplina de packages

- `shared`: schemas, env, errors, constants, utils PUROS. PROIBIDO: lógica de domínio, adapters HTTP, helpers de feature.
- `bnmp`: NUNCA expor DTOs cruas (dto/), parsers internos, utils. Barrel só re-exporta API pública.
- `db`: ZERO chamadas HTTP. Apenas repositories + Prisma.
- `queue`: agnóstico de domínio. Não importa `@bnmp/bnmp` / `@bnmp/telegram`.

## 6. Pipeline obrigatório (toda mudança)

1. Planejar etapa.
2. Listar arquivos afetados.
3. Implementar incrementalmente.
4. `pnpm turbo run typecheck lint build` verde.
5. Atualizar bloco STATUS (§11).
6. Parar e aguardar confirmação.

## 7. Economia de tokens

NÃO: reescrever arquivos inteiros sem necessidade; repetir arquitetura já fixada; regenerar código inalterado; criar abstrações prematuras; duplicar comentários; escrever documentação reativa.
SIM: editar só arquivos afetados; diffs objetivos; reusar contexto existente; commit small.

## 8. Worker (regras)

- Boot: `parseEnv(workerEnvSchema)` → `createLogger` → `startBoss` → `registerAllHandlers` → `startHealthServer` → `startHeartbeat` → `state.ready=true` → `awaitShutdown`.
- Endpoints HTTP: `/health/live` `/health/ready` `/health/worker` (com queue depth).
- Shutdown LIFO via `registerShutdown`: heartbeat → http → pg-boss (drain).
- pg-boss: retryLimit=5 default, retryBackoff, expireInHours=24, deleteAfterDays=14.
- Handlers idempotentes. Dedupe via `singletonKey` em `publishSingletonJob`.

## 9. Banco (entidades planejadas — Etapa 3)

`Tenant` `User` `MonitoredCity` `Warrant` `WarrantHistory` `TelegramConfig` `Alert` `WorkerLog` `BnmpSession` `PdfAsset`.
Índices: `(tenantId, bnmpId)` unique · `(tenantId, dataExpedicao DESC)` · `Alert(status)` · `WarrantHistory(warrantId, detectedAt)`.

## 10. Performance & Segurança

- Sem N+1. Paginação obrigatória em listagens. Batch upserts onde possível.
- Concorrência de jobs limitada (`teamSize`/`teamConcurrency`).
- Rate limit BNMP via `bottleneck` (target: `BNMP_RATE_LIMIT_RPM`, default 30 rpm).
- RBAC checado em middleware web E em cada server action.
- Multi-tenant: RLS + repos exigem `tenantId`.

## 11. STATUS

```
CURRENT_STAGE: 2 — DONE
LAST_COMPLETED:
  - Stage 1: monorepo bootstrap (pnpm@10.33.4 + turbo + Next15 + worker placeholder)
  - Stage 2:
    - packages/shared: env (zod), errors (AppError), constants (BNMP enums, SEED_CITIES, JOB_NAMES + typed payloads)
    - packages/logger: pino real (JSON prod / pretty dev, correlationId, withCorrelation, redact list)
    - packages/queue: pg-boss wrapper (startBoss, registerWorker, publishJob, scheduleCron, snapshotQueues, RETRY_POLICY)
    - packages/bnmp: internal carve-out (client/, session/, parsers/, pdf/, rate-limit/, normalizers/, dto/, types/, utils/)
    - apps/worker: real orchestration — env validation, pg-boss boot, stub handlers for all 5 JOB_NAMES, HTTP /health/live /health/ready /health/worker (with queue depth), SIGINT/SIGTERM graceful shutdown (LIFO), heartbeat every 60s
    - infra/docker: Dockerfile.worker (node:22-alpine, tini, non-root, healthcheck) + docker-compose.yml (postgres 16 + worker) + .dockerignore
    - .env.example × 3 (root + web + worker), .github/workflows/ci.yml (verify + docker-worker build)
    - 24/24 turbo tasks green (typecheck + lint + build); web build 102 kB First Load JS
NEXT_STEP: Stage 3 — Prisma schema (Tenant/User/MonitoredCity/Warrant/WarrantHistory/TelegramConfig/Alert/WorkerLog/BnmpSession/PdfAsset) + Supabase migrations + RLS policies + seed Palmeirópolis/Peixe/Ceres/Rialma (idMunicipio reais via /api/pesquisa-pecas/orgaos/municipio)
BLOCKERS:
  - idMunicipio reais de Peixe/Ceres/Rialma ainda placeholders (preencher via crawler em Stage 3)
  - Supabase project não provisionado (precisa rodar manualmente ou via Vercel Marketplace antes de Stage 3)
  - Docker compose build não foi testado nesta máquina (estrutura correta; iterar quando deployar)
```
