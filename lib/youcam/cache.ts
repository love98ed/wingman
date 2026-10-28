import { sha256 } from "@/lib/hash";

/** JSON with sorted keys, so equal params always hash the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export type CacheKeyInput = {
  selfieHash: string;
  productId?: string | null;
  api: string;
  params?: Record<string, unknown>;
};

/** CLAUDE.md section 4: hash of (selfie hash + product id + API name + params). */
export function renderCacheKey({ selfieHash, productId, api, params = {} }: CacheKeyInput): string {
  return sha256(stableStringify({ selfieHash, productId: productId ?? null, api, params }));
}

export type CachedRender = {
  cacheKey: string;
  api: string;
  /** Raw final poll response from YouCam. */
  response: unknown;
  image?: Buffer;
  imagePath?: string;
};

export interface RenderCacheStore {
  get(cacheKey: string): Promise<CachedRender | null>;
  put(
    entry: CachedRender & { selfieHash: string; productId?: string | null; params: Record<string, unknown> },
  ): Promise<CachedRender>;
}

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
