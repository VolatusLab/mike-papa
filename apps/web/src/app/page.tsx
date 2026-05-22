import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/session';

// Landing — redirects based on auth state. Public homepage can be built later.
export default async function RootPage() {
  const snap = await getCurrentSession();
  redirect(snap ? '/dashboard' : '/login');
}
