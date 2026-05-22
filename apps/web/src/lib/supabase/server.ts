import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/env.server';

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Supabase client bound to the request cookies. Use in Server Components,
 * Server Actions and Route Handlers. Never import in middleware (use the
 * middleware-specific factory there) or in client code.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot mutate cookies — middleware refreshes sessions.
        }
      },
    },
  });
}
