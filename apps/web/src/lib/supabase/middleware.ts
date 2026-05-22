import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/env.server';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Middleware-bound Supabase client. Refreshes the session by reading the
 * request cookies and writing refreshed ones onto a single NextResponse
 * that the middleware must return to keep cookies in sync.
 *
 * Returns the supabase client + the response that should be returned to the
 * client (already carrying refreshed Set-Cookie headers).
 *
 * IMPORTANT: do not run code between `createMiddlewareSupabase(request)` and
 * `supabase.auth.getUser()` — the @supabase/ssr lib needs that immediacy to
 * keep cookies coherent.
 */
export function createMiddlewareSupabase(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  return {
    supabase,
    get response() {
      return response;
    },
  };
}
