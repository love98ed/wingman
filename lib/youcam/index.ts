import "server-only";

import { getServerEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { YouCamClient, type YouCamResult } from "./client";
import { UnitGuard } from "./guard";
import { YouCamHttp } from "./http";
import { SupabaseRenderCache, SupabaseUsageStore } from "./supabase-stores";

export { YouCamClient, type YouCamResult, type Template } from "./client";
export { YouCamError, friendlyMessage, type YouCamErrorCode } from "./errors";

let instance: YouCamClient | undefined;

/** Shared client: Supabase-backed cache and unit guard, mock mode from MOCK_YOUCAM. */
export function youcam(): YouCamClient {
  if (!instance) {
    const env = getServerEnv();
    const db = supabaseAdmin();
    const dev = process.env.NODE_ENV !== "production";
    instance = new YouCamClient({
      http: new YouCamHttp(env.YOUCAM_API_KEY),
      guard: new UnitGuard(new SupabaseUsageStore(db), env.YOUCAM_UNIT_LIMIT, dev ? console.info : undefined),
      cache: new SupabaseRenderCache(db),
      mock: env.MOCK_YOUCAM,
    });
  }
  return instance;
}

/**
 * A URL the browser can load for a render: a 1-hour signed URL for stored renders,
 * or an inline data URL for mock fixtures (never stored).
 */
export async function renderUrl(result: YouCamResult): Promise<string | undefined> {
  if (result.imagePath) return new SupabaseRenderCache(supabaseAdmin()).signedUrl(result.imagePath);
  if (result.image) return `data:image/jpeg;base64,${result.image.toString("base64")}`;
  return undefined;
}
