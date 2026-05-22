import 'server-only';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getPrismaClient } from '@bnmp/db';

const prisma = getPrismaClient();

/**
 * Idempotent first-sign-in provisioning. Called from /auth/callback after a
 * successful code exchange.
 *
 * Onboarding model (Stage 10):
 *   1. User already provisioned → no-op.
 *   2. A pending, non-expired Invitation matches the email → user joins that
 *      tenant with the invited role; invitation marked ACCEPTED.
 *   3. No invitation → a fresh Tenant is created and the user becomes its ADMIN
 *      (self-serve SaaS signup).
 *
 * Safe under races: User.id PK (auth UUID) makes double-provisioning impossible;
 * the second writer just throws and the caller treats the row as present.
 */
export async function ensureLocalUserRow(supabaseUser: SupabaseUser): Promise<void> {
  const email = supabaseUser.email;
  if (!email) {
    throw new Error('Supabase user has no email — cannot create local profile');
  }

  const existing = await prisma.user.findUnique({ where: { id: supabaseUser.id } });
  if (existing) return;

  const invitation = await prisma.invitation.findFirst({
    where: { email: email.toLowerCase(), status: 'PENDING', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (invitation) {
    await prisma.$transaction([
      prisma.user.create({
        data: {
          id: supabaseUser.id,
          tenantId: invitation.tenantId,
          email,
          role: invitation.role,
        },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ]);
    return;
  }

  // Self-serve signup — own tenant, user is ADMIN.
  const tenant = await prisma.tenant.create({
    data: { name: `Tenant de ${email}`, plan: 'free', active: true },
  });
  await prisma.user.create({
    data: { id: supabaseUser.id, tenantId: tenant.id, email, role: 'ADMIN' },
  });
}
