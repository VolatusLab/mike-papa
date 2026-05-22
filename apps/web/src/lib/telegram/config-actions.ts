'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { repos } from '@/lib/repos';
import { canAddTelegramConfig } from '@/lib/plan';

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

// Telegram bot token shape: <digits>:<35-char base64-ish>
const botTokenSchema = z.string().regex(/^\d+:[A-Za-z0-9_-]{20,}$/, 'Token do bot inválido');

const upsertSchema = z.object({
  label: z.string().min(1).max(40).default('default'),
  botToken: botTokenSchema,
  chatId: z.string().min(1, 'chat_id obrigatório'),
  alertEnabled: z.coerce.boolean().default(true),
  sendPdf: z.coerce.boolean().default(true),
});

function flatten(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

export async function upsertTelegramConfigAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireUser();
  const raw = flatten(formData);
  // checkbox semantics — present means true
  const parsed = upsertSchema.safeParse({
    ...raw,
    alertEnabled: raw.alertEnabled === 'on' || raw.alertEnabled === 'true',
    sendPdf: raw.sendPdf === 'on' || raw.sendPdf === 'true',
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  // Plan limit only blocks NEW configs — re-saving an existing label is an update.
  const owned = await repos.telegramConfig.listByUser(user.id);
  const isUpdate = owned.some((c) => c.label === parsed.data.label);
  if (!isUpdate) {
    const tenant = await repos.tenant.findById(user.tenantId);
    const limit = await canAddTelegramConfig(user.tenantId, tenant?.plan ?? 'free');
    if (!limit.allowed) {
      return {
        ok: false,
        error: `Limite do plano atingido (${limit.current}/${limit.max} configs Telegram). Faça upgrade do plano.`,
      };
    }
  }

  await repos.telegramConfig.upsert(user.tenantId, {
    userId: user.id,
    label: parsed.data.label,
    botToken: parsed.data.botToken,
    chatId: parsed.data.chatId,
    alertEnabled: parsed.data.alertEnabled,
    sendPdf: parsed.data.sendPdf,
  });
  revalidatePath('/dashboard/telegram');
  return { ok: true, message: 'Configuração salva.' };
}

export async function toggleTelegramConfigAction(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = String(formData.get('id') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!id) return;
  // Ownership: setEnabled is tenant-scoped; verify the config belongs to this user.
  const cfg = await repos.telegramConfig.findById(user.tenantId, id);
  if (cfg && cfg.userId === user.id) {
    await repos.telegramConfig.setEnabled(user.tenantId, id, enabled);
    revalidatePath('/dashboard/telegram');
  }
}
