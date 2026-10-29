import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { RENDERS_BUCKET } from "@/lib/youcam/supabase-stores";

/** Renders and cached results made from a photo are deleted this long after they're made. */
export const KEEP_HOURS = 24;
const BATCH = 500;

async function removeFiles(db: SupabaseClient, paths: string[]) {
  for (let i = 0; i < paths.length; i += BATCH) {
    const { error } = await db.storage.from(RENDERS_BUCKET).remove(paths.slice(i, i + BATCH));
    if (error) throw new Error(`Render delete failed: ${error.message}`);
  }
}

/** Delete every render and cached result made from one photo ("Delete my photo"). */
export async function deletePhotoData(db: SupabaseClient, photoHash: string): Promise<void> {
  // Renders live under {photoHash}/; list the folder too, in case a row was never written.
  const { data: files, error } = await db.storage.from(RENDERS_BUCKET).list(photoHash, { limit: 1000 });
  if (error) throw new Error(`Render list failed: ${error.message}`);
  await removeFiles(db, files.map((f) => `${photoHash}/${f.name}`));
  const { error: rowError } = await db.from("render_cache").delete().eq("selfie_sha256", photoHash);
  if (rowError) throw new Error(`Render cache delete failed: ${rowError.message}`);
}

/** Delete renders and cached results older than KEEP_HOURS. Returns how many were deleted. */
export async function deleteExpired(db: SupabaseClient, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - KEEP_HOURS * 3600_000).toISOString();
  let deleted = 0;
  for (;;) {
    const { data, error } = await db
      .from("render_cache")
      .select("cache_key, output_path")
      .lt("created_at", cutoff)
      .limit(BATCH);
    if (error) throw new Error(`Expired render read failed: ${error.message}`);
    if (data.length === 0) return deleted;
    await removeFiles(db, data.flatMap((r) => (r.output_path ? [r.output_path as string] : [])));
    const { error: rowError } = await db
      .from("render_cache")
      .delete()
      .in("cache_key", data.map((r) => r.cache_key as string));
    if (rowError) throw new Error(`Expired render delete failed: ${rowError.message}`);
    deleted += data.length;
    if (data.length < BATCH) return deleted;
  }
}
