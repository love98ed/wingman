import { createBrowserClient } from "@supabase/ssr";

/** Anon client for the browser. RLS blocks table access; use API routes for data. */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
