'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signInAction, type ActionResult } from '@/lib/auth/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/auth/submit-button';

const initial: ActionResult = { ok: false };

export function LoginForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [state, action] = useActionState(signInAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton>Entrar</SubmitButton>

      <div className="flex justify-between text-sm text-slate-500">
        <Link href="/forgot-password" className="hover:text-slate-900 hover:underline">
          Esqueci minha senha
        </Link>
        <Link href="/signup" className="hover:text-slate-900 hover:underline">
          Criar conta
        </Link>
      </div>
    </form>
  );
}
