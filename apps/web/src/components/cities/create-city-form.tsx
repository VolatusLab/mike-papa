'use client';

import { useActionState } from 'react';
import { createCityAction, type ActionResult } from '@/lib/cities/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/auth/submit-button';

const initial: ActionResult = { ok: false };

export function CreateCityForm() {
  const [state, action] = useActionState(createCityAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex w-44 flex-col gap-1">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required placeholder="Palmeirópolis" />
      </div>
      <div className="flex w-20 flex-col gap-1">
        <Label htmlFor="uf">UF</Label>
        <Input id="uf" name="uf" required maxLength={2} placeholder="TO" />
      </div>
      <div className="flex w-28 flex-col gap-1">
        <Label htmlFor="idEstado">idEstado</Label>
        <Input id="idEstado" name="idEstado" type="number" required placeholder="27" />
      </div>
      <div className="flex w-32 flex-col gap-1">
        <Label htmlFor="idMunicipio">idMunicipio</Label>
        <Input id="idMunicipio" name="idMunicipio" type="number" required placeholder="9655" />
      </div>
      <div className="flex w-24 flex-col gap-1">
        <Label htmlFor="idTipoPeca">Tipo peça</Label>
        <Input id="idTipoPeca" name="idTipoPeca" type="number" defaultValue={1} />
      </div>
      <SubmitButton>Adicionar</SubmitButton>

      {state.error ? (
        <div className="w-full">
          <Alert tone="error">{state.error}</Alert>
        </div>
      ) : null}
      {state.ok && state.message ? (
        <div className="w-full">
          <Alert tone="success">{state.message}</Alert>
        </div>
      ) : null}
    </form>
  );
}
