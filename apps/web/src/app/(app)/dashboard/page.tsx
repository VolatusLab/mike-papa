import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { repos } from '@/lib/repos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, statusTone } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Stat, BarList } from '@/components/ui/stat';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{ status?: string; city?: string; q?: string; page?: string }>;
}

function brDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(d);
}

export default async function WarrantsDashboard({ searchParams }: PageProps) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const tenantId = user.tenantId;

  const page = Math.max(0, Number.parseInt(sp.page ?? '0', 10) || 0);
  const filters = {
    status: sp.status || undefined,
    monitoredCityId: sp.city || undefined,
    search: sp.q || undefined,
  };

  const [rows, total, statusCounts, cities] = await Promise.all([
    repos.warrant.listWithCity(tenantId, {
      ...filters,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    repos.warrant.count(tenantId, filters),
    repos.warrant.countByStatus(tenantId),
    repos.monitoredCity.list(tenantId, { limit: 200 }),
  ]);

  const totalAll = statusCounts.reduce((acc, s) => acc + s.count, 0);

  const hrefFor = (p: number): string => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.monitoredCityId) params.set('city', filters.monitoredCityId);
    if (filters.search) params.set('q', filters.search);
    if (p > 0) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/dashboard?${qs}` : '/dashboard';
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mandados</h1>
        <p className="text-sm text-slate-500">Mandados detectados nas cidades monitoradas.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total de mandados" value={totalAll} />
        <Stat
          label="Pendentes de cumprimento"
          value={statusCounts.find((s) => s.status.toLowerCase().includes('pendente'))?.count ?? 0}
        />
        <Stat label="Cidades monitoradas" value={cities.filter((c) => c.ativo).length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por status</CardTitle>
        </CardHeader>
        <CardContent>
          <BarList items={statusCounts.map((s) => ({ label: s.status, value: s.count }))} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <form method="get" action="/dashboard" className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-slate-600" htmlFor="q">
                Buscar por nome
              </label>
              <Input
                id="q"
                name="q"
                defaultValue={filters.search ?? ''}
                placeholder="Nome da pessoa"
              />
            </div>
            <div className="flex w-48 flex-col gap-1">
              <label className="text-xs font-medium text-slate-600" htmlFor="status">
                Status
              </label>
              <Select id="status" name="status" defaultValue={filters.status ?? ''}>
                <option value="">Todos</option>
                {statusCounts.map((s) => (
                  <option key={s.status} value={s.status}>
                    {s.status}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex w-52 flex-col gap-1">
              <label className="text-xs font-medium text-slate-600" htmlFor="city">
                Cidade
              </label>
              <Select id="city" name="city" defaultValue={filters.monitoredCityId ?? ''}>
                <option value="">Todas</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}/{c.uf}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Filtrar</Button>
            <Link
              href="/dashboard"
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-900"
            >
              Limpar
            </Link>
          </form>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pessoa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Expedição</TableHead>
            <TableHead>Órgão</TableHead>
            <TableHead>PDF</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={6} message="Nenhum mandado encontrado." />
          ) : (
            rows.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium text-slate-800">{w.nomePessoa}</TableCell>
                <TableCell>
                  <Badge tone={statusTone(w.descricaoStatus)}>{w.descricaoStatus}</Badge>
                </TableCell>
                <TableCell className="text-slate-600">
                  {w.monitoredCity.nome}/{w.monitoredCity.uf}
                </TableCell>
                <TableCell className="tabular-nums text-slate-600">
                  {brDate(w.dataExpedicao)}
                </TableCell>
                <TableCell className="max-w-56 truncate text-slate-600" title={w.nomeOrgao}>
                  {w.nomeOrgao}
                </TableCell>
                <TableCell>
                  {w.pdfAssetId ? (
                    <Badge tone="success">Disponível</Badge>
                  ) : (
                    <Badge tone="neutral">—</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={hrefFor} />
    </div>
  );
}
