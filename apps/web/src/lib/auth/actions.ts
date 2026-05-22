'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/auth/schemas';

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function flatten(input: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of input.entries()) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

async function originUrl(): Promise<string> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

// ─── Sign in ────────────────────────────────────────────────────────────────

export async function signInAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(flatten(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

// ─── Sign up ────────────────────────────────────────────────────────────────

export async function signUpAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(flatten(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const supabase = await createSupabaseServerClient();
  const origin = await originUrl();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    message:
      'Cadastro recebido. Confira o email para confirmar (se a confirmação estiver ativada no Supabase).',
  };
}

// ─── Sign out ───────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

// ─── Forgot password ────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(flatten(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Email inválido' };
  }
  const supabase = await createSupabaseServerClient();
  const origin = await originUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: 'Email de recuperação enviado se a conta existir.' };
}

// ─── Reset password (after callback) ────────────────────────────────────────

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(flatten(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  redirect('/dashboard?message=password_updated');
}
