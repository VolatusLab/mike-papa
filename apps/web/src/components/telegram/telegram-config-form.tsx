'use client';

import { useActionState } from 'react';
import { upsertTelegramConfigAction, type ActionResult } from '@/lib/telegram/config-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/auth/submit-button';

const initial: ActionResult = { ok: false };

export function TelegramConfigForm() {
  const [state, action] = useActionState(upsertTelegramConfigAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="label">Rótulo</Label>
        <Input id="label" name="label" defaultValue="default" maxLength={40} required />
        <p className="text-xs text-slate-400">
          Salvar com o mesmo rótulo atualiza a configuração existente.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="botToken">Token do bot</Label>
        <Input
          id="botToken"
          name="botToken"
          type="password"
          autoComplete="off"
          required
          placeholder="123456789:ABCdef..."
        />
        <p className="text-xs text-slate-400">
          Criptografado em repouso (AES-256-GCM). Nunca é exibido depois de salvo.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chatId">chat_id</Label>
        <Input id="chatId" name="chatId" required placeholder="-1001234567890" />
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="alertEnabled" defaultChecked className="h-4 w-4" />
          Alertas ativos
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="sendPdf" defaultChecked className="h-4 w-4" />
          Enviar PDF
        </label>
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <SubmitButton>Salvar configuração</SubmitButton>
    </form>
  );
}
