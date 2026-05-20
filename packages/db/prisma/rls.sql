-- ────────────────────────────────────────────────────────────────────────────
-- Row Level Security (Supabase) — apply AFTER `prisma migrate deploy`.
-- Idempotent: uses `create or replace` / `drop policy if exists`.
--
-- Pattern: tenant scope is derived from the authenticated user via a
-- SECURITY DEFINER helper that reads public.users.tenant_id by auth.uid().
-- Service-role connections (worker / migrations) bypass RLS by design.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.users where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.users where id = auth.uid()
$$;

-- ─── Enable RLS ─────────────────────────────────────────────────────────────

alter table public.tenants            enable row level security;
alter table public.users              enable row level security;
alter table public.monitored_cities   enable row level security;
alter table public.warrants           enable row level security;
alter table public.warrant_history    enable row level security;
alter table public.telegram_configs   enable row level security;
alter table public.alerts             enable row level security;
alter table public.worker_logs        enable row level security;
alter table public.pdf_assets         enable row level security;
alter table public.bnmp_sessions      enable row level security;

-- ─── Policies ───────────────────────────────────────────────────────────────

-- Tenants: read own tenant only
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using (id = public.current_tenant_id());

-- Users: read self; ADMIN/MODERATOR read tenant users; update self only
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select using (
    id = auth.uid()
    or (
      tenant_id = public.current_tenant_id()
      and public.current_user_role() in ('ADMIN', 'MODERATOR')
    )
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- MonitoredCity: tenant read; ADMIN/MODERATOR write
drop policy if exists mc_select on public.monitored_cities;
create policy mc_select on public.monitored_cities
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists mc_modify on public.monitored_cities;
create policy mc_modify on public.monitored_cities
  for all using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('ADMIN', 'MODERATOR')
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('ADMIN', 'MODERATOR')
  );

-- Warrants / WarrantHistory: tenant read-only (writes via service_role)
drop policy if exists w_select on public.warrants;
create policy w_select on public.warrants
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists wh_select on public.warrant_history;
create policy wh_select on public.warrant_history
  for select using (tenant_id = public.current_tenant_id());

-- Telegram configs: per-user; ADMIN sees tenant
drop policy if exists tg_select on public.telegram_configs;
create policy tg_select on public.telegram_configs
  for select using (
    user_id = auth.uid()
    or (
      tenant_id = public.current_tenant_id()
      and public.current_user_role() = 'ADMIN'
    )
  );

drop policy if exists tg_modify on public.telegram_configs;
create policy tg_modify on public.telegram_configs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Alerts: tenant read
drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts
  for select using (tenant_id = public.current_tenant_id());

-- WorkerLogs: ADMIN only
drop policy if exists wl_select on public.worker_logs;
create policy wl_select on public.worker_logs
  for select using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() = 'ADMIN'
  );

-- PdfAssets: tenant read (download via signed Supabase Storage URL)
drop policy if exists pdf_select on public.pdf_assets;
create policy pdf_select on public.pdf_assets
  for select using (tenant_id = public.current_tenant_id());

-- bnmp_sessions: no anon/authenticated access at all (service_role only)
-- (RLS enabled with no policies => all rows blocked for non-service roles)
