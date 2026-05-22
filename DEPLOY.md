# Deploy — bnmp-monitor

Dois artefatos independentes: **web** (Vercel) e **worker** (Docker — Railway/Fly/VPS).
Ambos compartilham o mesmo Postgres (Supabase) e o mesmo `ENCRYPTION_KEY`.

## 1. Supabase

1. Crie um projeto em supabase.com.
2. Em **Project Settings → Database**, copie:
   - `DATABASE_URL` — connection pooler (porta 6543, `?pgbouncer=true`)
   - `DIRECT_URL` — conexão direta (porta 5432) — usada só por migrations
3. Em **Project Settings → API**, copie:
   - `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` (mesmo valor)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role key — secreta)
4. Em **Storage**, crie um bucket **privado** com o nome de `SUPABASE_STORAGE_BUCKET`
   (default `bnmp-pdfs`).
5. **Auth → Providers → Email**: habilite. Para dev, desabilite "Confirm email"
   (signup gera sessão direta); para produção, mantenha habilitado.
6. Gere o `ENCRYPTION_KEY` (mesmo valor em web e worker):
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## 2. Banco — migrations + RLS + seed

Com `DATABASE_URL` e `DIRECT_URL` preenchidos num `.env` local:

```bash
pnpm install
pnpm --filter @bnmp/db db:generate
pnpm --filter @bnmp/db db:migrate -- --name init   # primeira vez (cria migration)
pnpm --filter @bnmp/db db:rls                       # aplica políticas RLS
pnpm --filter @bnmp/db db:seed                      # opcional — dados de dev
```

Em CI/CD de produção use `db:migrate:deploy` (aplica migrations existentes, não cria).

> O `db:seed` cria um "Default Tenant" + 4 cidades de exemplo (dev). Em produção,
> o primeiro usuário que se cadastrar cria o **próprio tenant** e vira ADMIN dele.

## 3. Web → Vercel

1. Importe o repositório na Vercel. Root: a raiz do monorepo.
2. **Build settings**:
   - Framework: Next.js
   - Build command: `pnpm turbo run build --filter @bnmp/web`
   - Install: `pnpm install`
   - Output: `apps/web/.next`
3. **Environment Variables** (Production): `NODE_ENV`, `DATABASE_URL`, `DIRECT_URL`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ENCRYPTION_KEY`, `WORKER_HEALTH_URL`.
4. Deploy. O primeiro signup vira ADMIN do novo tenant.

## 4. Worker → Docker (Railway / Fly / VPS)

O worker NÃO roda na Vercel (precisa de processo persistente para o cron).

**Build:**

```bash
docker build -f infra/docker/Dockerfile.worker -t bnmp-worker .
```

**Railway:** novo serviço a partir do repo, Dockerfile `infra/docker/Dockerfile.worker`,
definir as envs da seção worker abaixo, expor porta 8080.

**Fly.io:** `fly launch --dockerfile infra/docker/Dockerfile.worker`, setar envs via
`fly secrets set`, healthcheck em `/health/live`.

**VPS:** `docker compose -f infra/docker/docker-compose.yml up -d` (sobe Postgres
local + worker — para produção aponte `DATABASE_URL` ao Supabase e remova o serviço postgres).

**Envs do worker:** `NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL`, `PGBOSS_SCHEMA`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`,
`ENCRYPTION_KEY`, `BNMP_*`, `WORKER_PORT`. Ver `.env.example`.

## 5. Pós-deploy

- Healthchecks do worker: `/health/live`, `/health/ready`, `/health/worker`.
- Aponte `WORKER_HEALTH_URL` (na web) para a URL pública do worker → painel `/admin`
  mostra status e profundidade das filas.
- Primeiro ADMIN: cadastre-se em `/signup`. Convide os demais em `/admin/users`.
- Cadastre cidades reais em `/dashboard/cities` (idEstado/idMunicipio vêm dos
  domínios do BNMP) e o bot Telegram em `/dashboard/telegram`.

## 6. Operação

- Scan automático: cron `BNMP_POLL_INTERVAL_CRON` (default 5 min).
- Scan retroativo: cron `BNMP_RETROACTIVE_CRON` (default diário 03:00).
- Logs do worker: stdout (Railway/Fly log viewer) + resumos persistidos em
  `worker_logs` (visíveis em `/admin`).
- Smoke contra o portal real, sem DB: `pnpm --filter @bnmp/worker smoke`.
