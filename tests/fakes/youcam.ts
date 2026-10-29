/** In-memory stand-ins for the Supabase stores, for unit tests. */
import type { CachedRender, RenderCacheStore } from "@/lib/youcam/cache";
import { YouCamError } from "@/lib/youcam/errors";
import type { UsageStore } from "@/lib/youcam/guard";

export class MemoryRenderCache implements RenderCacheStore {
  entries = new Map<string, CachedRender>();
  async get(key: string) {
    return this.entries.get(key) ?? null;
  }
  async put(entry: CachedRender) {
    this.entries.set(entry.cacheKey, entry);
    return entry;
  }
}

/** In-memory store with the same semantics as the Supabase function, for tests and mock mode. */
export class MemoryUsageStore implements UsageStore {
  rows: { id: number; api: string; units: number; status: "reserved" | "ok" | "failed" }[] = [];

  async reserve(api: string, units: number, limit: number): Promise<number> {
    const used = await this.total();
    if (used + units > limit) {
      throw new YouCamError("QUOTA", `YouCam unit limit reached (${used} + ${units} > ${limit})`);
    }
    const id = this.rows.length + 1;
    this.rows.push({ id, api, units, status: "reserved" });
    return id;
  }

  async settle(id: number, status: "ok" | "failed") {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.status = status;
  }

  async total() {
    return this.rows.filter((r) => r.status !== "failed").reduce((s, r) => s + r.units, 0);
  }

  async totalsByApi() {
    const out: Record<string, number> = {};
    for (const r of this.rows) if (r.status !== "failed") out[r.api] = (out[r.api] ?? 0) + r.units;
    return out;
  }
}
