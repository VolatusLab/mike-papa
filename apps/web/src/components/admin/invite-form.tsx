'use client';

import { useActionState } from 'react';
import { createInvitationAction, type ActionResult } from '@/lib/invitations/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/auth/submit-button';

const initial: ActionResult = { ok: false };

export function InviteForm() {
  const [state, action] = useActionState(createInvitationAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-56 flex-1 flex-col gap-1">
        <Label htmlFor="invite-email">Email do convidado</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="pessoa@exemplo.com"
        />
      </div>
      <div className="flex w-44 flex-col gap-1">
        <Label htmlFor="invite-role">Papel</Label>
        <Select id="invite-role" name="role" defaultValue="USER">
          <option value="USER">USER</option>
          <option value="MODERATOR">MODERATOR</option>
          <option value="ADMIN">ADMIN</option>
        </Select>
      </div>
      <SubmitButton>Convidar</SubmitButton>

      {state.error ? (
        <div className="w-full">
          <Alert tone="error">{state.error}</Alert>
        </div>
      ) : null}
      {state.ok && state.message ? (
        <div className="w-full">
          <Alert tone="success">
            {state.message} A pessoa entra automaticamente ao se cadastrar com esse email.
          </Alert>
        </div>
      ) : null}
    </form>
  );
}
