import "server-only";

import { getServerEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { YouCamClient } from "./client";
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
