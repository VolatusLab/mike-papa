import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Role, User } from '@bnmp/db';
import { getPrismaClient } from '@bnmp/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const prisma = getPrismaClient();

export interface AuthSnapshot {
  authUserId: string;
  email: string;
  /** Local profile row in public.users (may be null on first sign-in, until sync runs). */
  user: User | null;
}

/**
 * Returns the authenticated session as seen by Supabase + the local profile row.
 * Cached per-request via React `cache` so callers may invoke it freely.
 * Returns null if no session.
 */
export const getCurrentSession = cache(async (): Promise<AuthSnapshot | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const local = await prisma.user.findUnique({ where: { id: data.user.id } });
  return {
    authUserId: data.user.id,
    email: data.user.email ?? '',
    user: local,
  };
});

/** Redirect to /login if unauthenticated. Returns the snapshot otherwise. */
export async function requireSession(redirectTo = '/login'): Promise<AuthSnapshot> {
  const snap = await getCurrentSession();
  if (!snap) redirect(redirectTo);
  return snap;
}

/** Redirect to /login if unauthenticated; to /dashboard if local row missing. */
export async function requireUser(redirectTo = '/login'): Promise<{
  authUserId: string;
  email: string;
  user: User;
}> {
  const snap = await requireSession(redirectTo);
  if (!snap.user) {
    // Auth row exists but local profile is missing — usually a transient state
    // (signup confirmed but callback didn't sync). Sending back to /login forces
    // a re-callback round-trip which will sync.
    redirect('/login?error=profile_missing');
  }
  return { authUserId: snap.authUserId, email: snap.email, user: snap.user };
}

/** Hard role gate. Redirects to /dashboard if role not allowed. */
export async function requireRole(allowed: readonly Role[]): Promise<User> {
  const { user } = await requireUser();
  if (!allowed.includes(user.role)) {
    redirect('/dashboard?error=forbidden');
  }
  return user;
}
