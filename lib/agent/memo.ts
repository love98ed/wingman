import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { renderCacheKey, type CacheKeyInput } from "@/lib/youcam/cache";
import { SupabaseRenderCache } from "@/lib/youcam/supabase-stores";

/**
 * Cache a JSON result in render_cache under the same key scheme as renders, so repeat
 * requests skip Claude. A cache that can't be read or written never fails the request.
 */
export async function memo<T>(input: CacheKeyInput, compute: () => Promise<T>): Promise<T> {
  const cache = new SupabaseRenderCache(supabaseAdmin());
  const cacheKey = renderCacheKey(input);
  const hit = await cache.get(cacheKey).catch(() => null);
  if (hit?.response != null) return hit.response as T;
  const value = await compute();
  await cache
    .put({ cacheKey, api: input.api, response: value, selfieHash: input.selfieHash, productId: input.productId, params: input.params ?? {} })
    .catch((err: Error) => console.warn(`[memo] ${input.api} not cached: ${err.message}`));
  return value;
}
