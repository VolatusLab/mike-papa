'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { repos } from '@/lib/repos';
import { canAddMember } from '@/lib/plan';

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const inviteSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['ADMIN', 'MODERATOR', 'USER']),
});

function flatten(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

/**
 * Create a tenant invitation (ADMIN-only). Enforces the plan's member cap
 * (active users + pending invites). The invitee joins automatically at first
 * sign-in with the matching email (see ensureLocalUserRow).
 */
export async function createInvitationAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireRole(['ADMIN']);
  const parsed = inviteSchema.safeParse(flatten(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const tenant = await repos.tenant.findById(admin.tenantId);
  const limit = await canAddMember(admin.tenantId, tenant?.plan ?? 'free');
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Limite do plano atingido (${limit.current}/${limit.max} membros). Faça upgrade do plano.`,
    };
  }

  const email = parsed.data.email.toLowerCase();
  const alreadyMember = await repos.user.findByEmail(email);
  if (alreadyMember) {
    return { ok: false, error: 'Esse email já é um usuário.' };
  }

  await repos.invitation.create(admin.tenantId, {
    email,
    role: parsed.data.role,
    invitedBy: admin.id,
  });
  revalidatePath('/admin/users');
  return { ok: true, message: `Convite criado para ${email}.` };
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const admin = await requireRole(['ADMIN']);
  const id = String(formData.get('id') ?? '');
  if (id) {
    await repos.invitation.revoke(admin.tenantId, id);
    revalidatePath('/admin/users');
  }
}
