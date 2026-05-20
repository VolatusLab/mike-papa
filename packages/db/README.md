# @bnmp/db

Único ponto de acesso ao banco. NUNCA importar `@prisma/client` fora deste pacote.

## Comandos

Todos via `pnpm --filter @bnmp/db <cmd>`:

| Comando                       | Quando usar                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| `db:generate`                 | regenera o client após editar `schema.prisma`                           |
| `db:migrate -- --name <name>` | cria + aplica migration em dev                                          |
| `db:migrate:deploy`           | aplica pending migrations em prod (CI/CD)                               |
| `db:seed`                     | seed idempotente (Tenant default + 4 cidades)                           |
| `db:rls`                      | aplica `prisma/rls.sql` (Supabase RLS) — rodar APÓS `db:migrate:deploy` |
| `db:studio`                   | abre Prisma Studio                                                      |
| `db:reset`                    | **destrutivo** — apaga DB + reaplica migrations + seed                  |

## Ordem para Supabase do zero

```bash
# 1. Provisionar projeto Supabase (UI ou Vercel Marketplace)
# 2. Preencher DATABASE_URL (pooled) + DIRECT_URL (direct) no .env
pnpm --filter @bnmp/db db:migrate -- --name init
pnpm --filter @bnmp/db db:rls
pnpm --filter @bnmp/db db:seed
```

## Adicionando colunas

1. Editar `prisma/schema.prisma`
2. `pnpm --filter @bnmp/db db:migrate -- --name add_<algo>`
3. Atualizar repositório correspondente em `src/repositories/`
4. Atualizar `rls.sql` se nova tabela tenant-scoped

## Segredos em colunas

Use `encryptSecret(plaintext)` antes de inserir em colunas `Bytes` (botToken, cookie).
Use `decryptSecret(blob)` apenas em memória — NUNCA logue valor decriptado.
Chave: `ENCRYPTION_KEY` (64 hex chars). Gerar com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
