import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env.server";

let admin: SupabaseClient | undefined;

/**
 * Service-role client. All tables have RLS on with no policies,
 * so every read and write goes through this client on the server.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const env = getServerEnv();
    admin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return admin;
}
