'use client';

import { useActionState } from 'react';
import { toggleCityAction, updateCityAction, type ActionResult } from '@/lib/cities/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { SubmitButton } from '@/components/auth/submit-button';

export interface CityRowData {
  id: string;
  nome: string;
  uf: string;
  idEstado: number;
  idMunicipio: number;
  ativo: boolean;
  lastScanAt: string | null;
}

const initial: ActionResult = { ok: false };

export function CityRow({ city }: { city: CityRowData }) {
  const [state, action] = useActionState(updateCityAction, initial);

  return (
    <TableRow>
      <TableCell className="font-medium text-slate-800">{city.nome}</TableCell>
      <TableCell className="text-slate-600">{city.uf}</TableCell>
      <TableCell className="tabular-nums text-slate-500">{city.idEstado}</TableCell>
      <TableCell>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="id" value={city.id} />
          <input type="hidden" name="nome" value={city.nome} />
          <Input
            name="idMunicipio"
            type="number"
            defaultValue={city.idMunicipio}
            className="h-8 w-28"
          />
          <SubmitButton size="sm" variant="secondary">
            Salvar
          </SubmitButton>
          {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
          {state.ok ? <span className="text-xs text-emerald-600">✓</span> : null}
        </form>
      </TableCell>
      <TableCell>
        {city.ativo ? <Badge tone="success">Ativa</Badge> : <Badge tone="neutral">Inativa</Badge>}
      </TableCell>
      <TableCell className="text-xs text-slate-400">
        {city.lastScanAt ? new Date(city.lastScanAt).toLocaleString('pt-BR') : 'nunca'}
      </TableCell>
      <TableCell>
        <form action={toggleCityAction}>
          <input type="hidden" name="id" value={city.id} />
          <input type="hidden" name="ativo" value={String(!city.ativo)} />
          <Button type="submit" size="sm" variant={city.ativo ? 'ghost' : 'secondary'}>
            {city.ativo ? 'Desativar' : 'Ativar'}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}
