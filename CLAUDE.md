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
apps/web              Next.js 15 App Router (Vercel)
apps/worker           orchestrator — registra handlers, health, shutdown
packages/shared       schemas zod, env, errors, constants (BNMP enums, JOB_NAMES)
packages/db           Prisma schema + client + repositories + crypto AES-GCM (acesso ao banco SOMENTE aqui)
packages/db/prisma    schema.prisma, seed.ts, rls.sql (canônicos)
packages/bnmp         client/, session/, parsers/, pdf/, rate-limit/, normalizers/, dto/, types/, utils/
packages/queue        pg-boss wrapper: startBoss, registerWorker, publishJob, scheduleCron
packages/telegram     TelegramService (sendMessage, sendDocument)
packages/logger       pino: createLogger, newCorrelationId, withCorrelation
infra/docker          Dockerfile.worker + docker-compose.yml
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

## 9. Banco (Etapa 3 — DONE)

Entidades: `Tenant` `User` `MonitoredCity` `Warrant` `WarrantHistory` `TelegramConfig` `Alert` `WorkerLog` `BnmpSession` `PdfAsset`.
Enums: `Role(ADMIN|MODERATOR|USER)` · `AlertStatus(PENDING|SENT|FAILED|SKIPPED)` · `WarrantChangeKind(CREATED|UPDATED|STATUS_CHANGED|REVOKED|REPUBLISHED)`.
Índices críticos: `Warrant(tenantId, bnmpId)` unique · `Warrant(tenantId, dataExpedicao DESC)` · `Alert(status, createdAt)` · `WarrantHistory(warrantId, detectedAt DESC)` · `PdfAsset(tenantId, sha256)` unique.
Encriptação: AES-256-GCM para `TelegramConfig.botTokenEnc` e `BnmpSession.cookieEnc` via `encryptSecret/decryptSecret` (chave `ENCRYPTION_KEY`).
RLS: ver `packages/db/prisma/rls.sql`. Helpers `public.current_tenant_id()` e `public.current_user_role()` derivam de `auth.uid()`. Service-role bypassa RLS (worker usa SERVICE_ROLE_KEY).
Comandos: `pnpm --filter @bnmp/db db:{generate,migrate,migrate:deploy,seed,rls,studio,reset}` — ver `packages/db/README.md`.

## 10. Performance & Segurança

- Sem N+1. Paginação obrigatória em listagens. Batch upserts onde possível.
- Concorrência de jobs limitada (`teamSize`/`teamConcurrency`).
- Rate limit BNMP via `bottleneck` (target: `BNMP_RATE_LIMIT_RPM`, default 30 rpm).
- RBAC checado em middleware web E em cada server action.
- Multi-tenant: RLS + repos exigem `tenantId`.

## 11. STATUS

```
CURRENT_STAGE: 10 — DONE · PROJETO COMPLETO (10/10 etapas)
LAST_COMPLETED (resumo — detalhe nas §3-10):
  - Stage 1-2: monorepo pnpm@10.33.4 + turbo + Next15 + worker orchestration + Docker + CI
  - Stage 3: Prisma schema + AES-GCM crypto + repos + seed + RLS
  - Stage 4: Supabase Auth + RBAC + middleware + auth pages/forms
  - Stage 5: packages/bnmp real (parsers/normalizers/session/rate-limit/client)
  - Stage 6: worker handlers reais (scan/retro/recheck) + warrant-sync diff + scheduler
  - Stage 7: packages/telegram real (BotApiClient + format MD-V2 + rate-limit) + handler
  - Stage 8: bnmp/pdf downloadPdf + worker storage (Supabase Storage) + pdf-download (dedup SHA256)
  - Stage 9: dashboard admin (mandados/cidades/telegram/admin/users + analytics + worker health)
  - Stage 10 — SaaS multi-tenant hardening:
    - Prisma: model Invitation + enum InvitationStatus (PENDING/ACCEPTED/REVOKED/EXPIRED)
    - InvitationRepository (create token-based, listPending, findActiveByEmail, markAccepted, revoke)
    - repos count: MonitoredCity.count, User.countByTenant, TelegramConfig.countByTenant
    - rls.sql: policies de invitations (ADMIN-only)
    - @bnmp/shared/constants/plans — PLAN_LIMITS free/pro/enterprise + planLimits() + checkLimit() + vitest (10 testes)
    - ensureLocalUserRow REESCRITO: 1º login → convite pendente por email entra no tenant+role; senão cria tenant próprio e vira ADMIN (self-serve SaaS — fim do "Default Tenant + SQL manual")
    - lib/plan.ts — getTenantUsage + canAddCity/canAddMember/canAddTelegramConfig
    - limites enforced: createCityAction, upsertTelegramConfigAction (só novos), createInvitationAction
    - lib/invitations/actions — createInvitationAction (ADMIN) + revokeInvitationAction
    - /admin/users — InviteForm + tabela de convites pendentes (revogar)
    - /admin — card Plano e uso (barras cidades/membros/telegram vs limites)
    - DEPLOY.md — runbook Supabase/Vercel/Railway · .env.example completo
    - turbo: 27/27 verdes (typecheck+lint+test+build); 60 testes vitest (38 bnmp + 12 telegram + 10 shared)
NEXT_STEP: nenhuma etapa pendente — sistema completo. Próximo é provisionar Supabase e fazer deploy (ver DEPLOY.md).
BLOCKERS / PENDÊNCIAS OPERACIONAIS (não-código):
  - Supabase project não provisionado — necessário para teste e2e e deploy (tudo só typechecked/built com stub envs)
  - Smoke BNMP real não executado (`pnpm --filter @bnmp/worker smoke`)
  - Bucket Supabase Storage criar no provisioning (nome = SUPABASE_STORAGE_BUCKET, default 'bnmp-pdfs')
  - Migration SQL inicial gerada no 1º `db:migrate dev --name init` contra DB real
  - shadcn/ui nunca foi inicializado — UI usa primitives próprias (Button/Input/Table/etc); migração futura opcional
  - Billing real (Stripe) fora de escopo — upgrade de plano = UPDATE Tenant.plan
```
