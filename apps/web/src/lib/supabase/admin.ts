import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/env.server';

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server contexts
 * (auth sync, admin actions). Never expose to the browser. No cookies/session
 * — this client always acts as the service role.
 */
export function createSupabaseAdminClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
