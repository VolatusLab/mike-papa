import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureLocalUserRow } from '@/lib/auth/sync';

/**
 * OAuth/magic-link/email-confirm callback.
 * Exchanges the one-time code for a session, then syncs the local users row.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error?.message ?? 'exchange_failed')}`,
        request.url,
      ),
    );
  }

  try {
    await ensureLocalUserRow(data.user);
  } catch (err) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(err instanceof Error ? err.message : 'sync_failed')}`,
        request.url,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
