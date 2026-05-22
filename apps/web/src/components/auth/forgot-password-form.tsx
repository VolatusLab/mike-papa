'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction, type ActionResult } from '@/lib/auth/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/auth/submit-button';

const initial: ActionResult = { ok: false };

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <SubmitButton>Enviar link</SubmitButton>

      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="text-slate-900 hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
