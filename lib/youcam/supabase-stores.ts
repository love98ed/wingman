import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CachedRender, RenderCacheStore } from "./cache";
import { YouCamError } from "./errors";
import type { UsageStore } from "./guard";

const RENDERS_BUCKET = "renders";

export class SupabaseUsageStore implements UsageStore {
  constructor(private readonly db: SupabaseClient) {}

  async reserve(api: string, units: number, limit: number, cacheKey: string): Promise<number> {
    const { data, error } = await this.db.rpc("reserve_youcam_units", {
      p_api: api,
      p_units: units,
      p_limit: limit,
      p_cache_key: cacheKey,
    });
    if (error) {
      if (error.message.includes("QUOTA")) {
        throw new YouCamError("QUOTA", `YouCam unit limit reached (${error.hint ?? `limit ${limit}`})`);
      }
      throw new YouCamError("UNKNOWN", `Unit guard unavailable: ${error.message}`);
    }
    return data as number;
  }

  async settle(id: number, status: "ok" | "failed") {
    const { error } = await this.db.from("youcam_usage").update({ status }).eq("id", id);
    if (error) throw new YouCamError("UNKNOWN", `Unit log update failed: ${error.message}`);
  }

  private async rows() {
    const { data, error } = await this.db.from("youcam_usage").select("api, units").neq("status", "failed");
    if (error) throw new YouCamError("UNKNOWN", `Unit log read failed: ${error.message}`);
    return data as { api: string; units: number }[];
  }

  async total() {
    return (await this.rows()).reduce((sum, r) => sum + r.units, 0);
  }

  async totalsByApi() {
    const out: Record<string, number> = {};
    for (const r of await this.rows()) out[r.api] = (out[r.api] ?? 0) + r.units;
    return out;
  }
}

export class SupabaseRenderCache implements RenderCacheStore {
  constructor(private readonly db: SupabaseClient) {}

  async get(cacheKey: string): Promise<CachedRender | null> {
    const { data, error } = await this.db
      .from("render_cache")
      .select("cache_key, api, output_path, response")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    let image: Buffer | undefined;
    if (data.output_path) {
      const file = await this.db.storage.from(RENDERS_BUCKET).download(data.output_path);
      if (file.error) return null; // image purged: treat as a miss and re-render
      image = Buffer.from(await file.data.arrayBuffer());
    }
    return { cacheKey, api: data.api, response: data.response, image, imagePath: data.output_path ?? undefined };
  }

  async put(entry: CachedRender & { selfieHash: string; productId?: string | null; params: Record<string, unknown> }) {
    let imagePath: string | undefined;
    if (entry.image) {
      imagePath = `${entry.selfieHash}/${entry.cacheKey}.jpg`;
      const up = await this.db.storage
        .from(RENDERS_BUCKET)
        .upload(imagePath, entry.image, { contentType: "image/jpeg", upsert: true });
      if (up.error) throw new YouCamError("UNKNOWN", `Render upload failed: ${up.error.message}`);
    }
    const { error } = await this.db.from("render_cache").upsert({
      cache_key: entry.cacheKey,
      api: entry.api,
      selfie_sha256: entry.selfieHash,
      product_id: entry.productId ?? null,
      params: entry.params,
      output_path: imagePath ?? null,
      response: entry.response,
    });
    if (error) throw new YouCamError("UNKNOWN", `Render cache write failed: ${error.message}`);
    return { ...entry, imagePath };
  }

  async signedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.db.storage.from(RENDERS_BUCKET).createSignedUrl(path, expiresInSeconds);
    if (error) throw new YouCamError("UNKNOWN", `Signed URL failed: ${error.message}`);
    return data.signedUrl;
  }
}
