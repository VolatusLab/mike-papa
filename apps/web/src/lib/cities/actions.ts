'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { repos } from '@/lib/repos';
import { canAddCity } from '@/lib/plan';

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const createSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  uf: z.string().length(2, 'UF deve ter 2 letras'),
  idEstado: z.coerce.number().int().positive('idEstado inválido'),
  idMunicipio: z.coerce.number().int().nonnegative('idMunicipio inválido'),
  idTipoPeca: z.coerce.number().int().positive().default(1),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1, 'Nome obrigatório'),
  idMunicipio: z.coerce.number().int().nonnegative('idMunicipio inválido'),
});

function flatten(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

export async function createCityAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRoleSafe();
  const parsed = createSchema.safeParse(flatten(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const tenant = await repos.tenant.findById(user.tenantId);
  const limit = await canAddCity(user.tenantId, tenant?.plan ?? 'free');
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Limite do plano atingido (${limit.current}/${limit.max} cidades). Faça upgrade do plano.`,
    };
  }
  await repos.monitoredCity.upsert(user.tenantId, {
    ...parsed.data,
    uf: parsed.data.uf.toUpperCase(),
    ativo: parsed.data.idMunicipio > 0,
  });
  revalidatePath('/dashboard/cities');
  return { ok: true, message: 'Cidade salva.' };
}

export async function updateCityAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireRoleSafe();
  const parsed = updateSchema.safeParse(flatten(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }
  const ok = await repos.monitoredCity.update(user.tenantId, parsed.data.id, {
    nome: parsed.data.nome,
    idMunicipio: parsed.data.idMunicipio,
  });
  if (!ok) return { ok: false, error: 'Cidade não encontrada' };
  revalidatePath('/dashboard/cities');
  return { ok: true, message: 'Atualizado.' };
}

export async function toggleCityAction(formData: FormData): Promise<void> {
  const { user } = await requireRoleSafe();
  const id = String(formData.get('id') ?? '');
  const ativo = String(formData.get('ativo') ?? '') === 'true';
  if (id) {
    await repos.monitoredCity.setActive(user.tenantId, id, ativo);
    revalidatePath('/dashboard/cities');
  }
}

async function requireRoleSafe() {
  const user = await requireRole(['ADMIN', 'MODERATOR']);
  return { user };
}
