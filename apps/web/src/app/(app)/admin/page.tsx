import Link from 'next/link';
import { PLAN_LABELS, type Plan } from '@bnmp/shared';
import { requireRole } from '@/lib/auth/session';
import { repos } from '@/lib/repos';
import { fetchWorkerHealth } from '@/lib/worker-health';
import { getTenantUsage } from '@/lib/plan';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Stat } from '@/components/ui/stat';
import { Badge } from '@/components/ui/badge';

function planLabel(plan: string): string {
  return PLAN_LABELS[plan as Plan] ?? plan;
}

function UsageRow({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const over = used >= max;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-slate-600">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
        <div
          className={`h-full rounded ${over ? 'bg-red-500' : 'bg-slate-700'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-sm tabular-nums text-slate-700">
        {used} / {max}
      </span>
    </div>
  );
}
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function logTone(level: string): 'danger' | 'warning' | 'neutral' | 'info' {
  if (level === 'error' || level === 'fatal') return 'danger';
  if (level === 'warn') return 'warning';
  if (level === 'info') return 'info';
  return 'neutral';
}

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function AdminHome() {
  const admin = await requireRole(['ADMIN']);
  const tenantId = admin.tenantId;

  const tenant = await repos.tenant.findById(tenantId);
  const [warrantTotal, alertCounts, cities, logs, health, usage] = await Promise.all([
    repos.warrant.count(tenantId),
    repos.alert.countByStatus(tenantId),
    repos.monitoredCity.list(tenantId, { limit: 200 }),
    repos.workerLog.listByTenant(tenantId, { limit: 25 }),
    fetchWorkerHealth(),
    getTenantUsage(tenantId, tenant?.plan ?? 'free'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Administração</h1>
          <p className="text-sm text-slate-500">Visão geral do tenant e do worker.</p>
        </div>
        <Link
          href="/admin/users"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Gerenciar usuários
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Mandados" value={warrantTotal} />
        <Stat label="Alertas enviados" value={alertCounts.SENT} />
        <Stat
          label="Alertas pendentes"
          value={alertCounts.PENDING}
          hint={`${alertCounts.FAILED} falhas`}
        />
        <Stat label="Cidades ativas" value={cities.filter((c) => c.ativo).length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano e uso</CardTitle>
          <CardDescription>
            Plano atual: <strong>{planLabel(usage.plan)}</strong>. Upgrade é alteração de
            <code className="mx-1 rounded bg-slate-100 px-1 text-xs">Tenant.plan</code>
            (billing fora de escopo).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <UsageRow label="Cidades" used={usage.cities.used} max={usage.cities.max} />
          <UsageRow label="Membros" used={usage.members.used} max={usage.members.max} />
          <UsageRow label="Telegram" used={usage.telegram.used} max={usage.telegram.max} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Worker</CardTitle>
          <CardDescription>Status em tempo real via endpoint /health/worker.</CardDescription>
        </CardHeader>
        <CardContent>
          {!health ? (
            <p className="text-sm text-slate-400">
              Worker offline ou WORKER_HEALTH_URL não configurado.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm">
                <Badge tone={health.status === 'ready' ? 'success' : 'warning'}>
                  {health.status}
                </Badge>
                <span className="text-slate-500">uptime {fmtUptime(health.uptimeSec)}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila</TableHead>
                    <TableHead>Aguardando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {health.queues.length === 0 ? (
                    <TableEmpty colSpan={2} message="Sem filas." />
                  ) : (
                    health.queues.map((q) => (
                      <TableRow key={q.name}>
                        <TableCell className="font-mono text-xs text-slate-700">{q.name}</TableCell>
                        <TableCell className="tabular-nums">{q.created}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs do worker</CardTitle>
          <CardDescription>Últimos 25 eventos persistidos para este tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableEmpty colSpan={4} message="Nenhum log ainda." />
              ) : (
                logs.map((l) => (
                  <TableRow key={String(l.id)}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-400">
                      {l.createdAt.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge tone={logTone(l.level)}>{l.level}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {l.jobName ?? '—'}
                    </TableCell>
                    <TableCell className="text-slate-700">{l.message}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
