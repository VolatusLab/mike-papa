'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { repos } from '@/lib/repos';

const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MODERATOR', 'USER']),
});

/**
 * Change a tenant member's role. ADMIN-only. Guards against self-demotion
 * (an admin removing their own ADMIN role could lock the tenant out).
 * Also enforces the target user belongs to the acting admin's tenant.
 */
export async function setUserRoleAction(formData: FormData): Promise<void> {
  const admin = await requireRole(['ADMIN']);
  const parsed = setRoleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  });
  if (!parsed.success) return;

  if (parsed.data.userId === admin.id && parsed.data.role !== 'ADMIN') {
    // refuse self-demotion silently — UI disables this anyway
    return;
  }

  const target = await repos.user.findById(parsed.data.userId);
  if (!target || target.tenantId !== admin.tenantId) return;

  await repos.user.setRole(parsed.data.userId, parsed.data.role);
  revalidatePath('/admin/users');
}
