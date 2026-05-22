import { requireRole } from '@/lib/auth/session';
import { repos } from '@/lib/repos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateCityForm } from '@/components/cities/create-city-form';
import { CityRow } from '@/components/cities/city-row';

export default async function CitiesPage() {
  const user = await requireRole(['ADMIN', 'MODERATOR']);
  const cities = await repos.monitoredCity.list(user.tenantId, { limit: 200 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cidades monitoradas</h1>
        <p className="text-sm text-slate-500">
          Cidades com <code>idMunicipio</code> 0 ficam inativas até o valor real ser preenchido.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar cidade</CardTitle>
          <CardDescription>
            idEstado e idMunicipio vêm dos domínios do BNMP (/api/dominio/estados,
            /api/pesquisa-pecas/orgaos/municipio).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCityForm />
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>UF</TableHead>
            <TableHead>idEstado</TableHead>
            <TableHead>idMunicipio</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Último scan</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cities.length === 0 ? (
            <TableEmpty colSpan={7} message="Nenhuma cidade cadastrada." />
          ) : (
            cities.map((c) => (
              <CityRow
                key={c.id}
                city={{
                  id: c.id,
                  nome: c.nome,
                  uf: c.uf,
                  idEstado: c.idEstado,
                  idMunicipio: c.idMunicipio,
                  ativo: c.ativo,
                  lastScanAt: c.lastScanAt ? c.lastScanAt.toISOString() : null,
                }}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
