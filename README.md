# BNMP Monitor

SaaS multi-tenant para monitoramento automatizado do portal BNMP (Banco Nacional de Medidas Penais e Prisões — CNJ).

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Web**: Next.js 15 (App Router) + Tailwind + shadcn/ui (hospedado na Vercel)
- **Worker**: Node.js + TypeScript + node-cron (Docker — Railway / Fly.io / VPS)
- **Banco**: Supabase Postgres + Prisma
- **Auth**: Supabase Auth (RBAC: ADMIN / MODERATOR / USER)
- **Storage de PDFs**: Supabase Storage
- **Alertas**: Telegram Bot API
- **Logger**: pino

## Estrutura

```
apps/
  web/         # Dashboard Next.js
  worker/      # Crawler BNMP + Telegram dispatcher
packages/
  shared/      # tipos, schemas Zod, errors, env validation
  db/          # Prisma client + repositories
  bnmp/        # BNMPClient, SessionManager, RateLimiter, Normalizer
  telegram/    # TelegramService
  logger/      # pino wrapper
infra/
  docker/      # Dockerfile.worker, docker-compose.yml
```

## Pré-requisitos

- Node.js >= 20 (recomendado 22 LTS)
- pnpm >= 11
- Docker (para worker local)

## Setup

```bash
pnpm install
pnpm turbo run typecheck
pnpm turbo run lint
pnpm dev                       # sobe web + worker
pnpm --filter web dev          # apenas web
pnpm --filter worker dev       # apenas worker
```

## Documentação operacional

Ver `CLAUDE.md` na raiz — contém regras arquiteturais fixas, convenções e estado atual do projeto.
