import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { deleteExpired, deletePhotoData, KEEP_HOURS } from "@/lib/privacy";

type Row = { cache_key: string; selfie_sha256: string; output_path: string | null; created_at: string };

/** Just enough of the Supabase client for lib/privacy.ts: render_cache rows and the renders bucket. */
function fakeDb(rows: Row[], files: string[]) {
  const state = { rows: [...rows], files: new Set(files) };
  const db = {
    from: (table: string) => {
      if (table !== "render_cache") throw new Error(`unexpected table ${table}`);
      return {
        select: () => {
          let result = state.rows;
          const q = {
            lt: (_col: "created_at", iso: string) => ((result = result.filter((r) => r.created_at < iso)), q),
            limit: async (n: number) => ({ data: result.slice(0, n), error: null }),
          };
          return q;
        },
        delete: () => ({
          eq: async (_col: "selfie_sha256", value: string) => {
            state.rows = state.rows.filter((r) => r.selfie_sha256 !== value);
            return { error: null };
          },
          in: async (_col: "cache_key", keys: string[]) => {
            state.rows = state.rows.filter((r) => !keys.includes(r.cache_key));
            return { error: null };
          },
        }),
      };
    },
    storage: {
      from: () => ({
        list: async (folder: string) => ({
          data: [...state.files].filter((f) => f.startsWith(`${folder}/`)).map((f) => ({ name: f.slice(folder.length + 1) })),
          error: null,
        }),
        remove: async (paths: string[]) => {
          paths.forEach((p) => state.files.delete(p));
          return { data: [], error: null };
        },
      }),
    },
  };
  return { db: db as unknown as SupabaseClient, state };
}

const now = new Date("2026-10-29T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
const row = (key: string, photo: string, ageHours: number, withFile = true): Row => ({
  cache_key: key,
  selfie_sha256: photo,
  output_path: withFile ? `${photo}/${key}.jpg` : null,
  created_at: hoursAgo(ageHours),
});

describe("deleteExpired", () => {
  it(`removes rows and their files once they are ${KEEP_HOURS} hours old, and nothing newer`, async () => {
    const rows = [row("old", "a", 25), row("edge", "a", KEEP_HOURS - 0.01), row("new", "b", 1), row("memo", "a", 30, false)];
    const { db, state } = fakeDb(rows, ["a/old.jpg", "a/edge.jpg", "b/new.jpg"]);
    expect(await deleteExpired(db, now)).toBe(2);
    expect(state.rows.map((r) => r.cache_key).sort()).toEqual(["edge", "new"]);
    expect([...state.files].sort()).toEqual(["a/edge.jpg", "b/new.jpg"]);
  });

  it("works through more rows than one batch", async () => {
    const rows = Array.from({ length: 1203 }, (_, i) => row(`k${i}`, "p", 48));
    const { db, state } = fakeDb(rows, rows.map((r) => r.output_path!));
    expect(await deleteExpired(db, now)).toBe(1203);
    expect(state.rows).toHaveLength(0);
    expect(state.files.size).toBe(0);
  });

  it("does nothing when nothing has expired", async () => {
    const { db, state } = fakeDb([row("new", "b", 2)], ["b/new.jpg"]);
    expect(await deleteExpired(db, now)).toBe(0);
    expect(state.rows).toHaveLength(1);
  });
});

describe("deletePhotoData", () => {
  it("removes every row and file for one photo and leaves other photos alone", async () => {
    const rows = [row("r1", "mine", 1), row("r2", "mine", 2, false), row("r3", "theirs", 1)];
    // A stray file with no row (its row write failed) is removed too.
    const { db, state } = fakeDb(rows, ["mine/r1.jpg", "mine/stray.jpg", "theirs/r3.jpg"]);
    await deletePhotoData(db, "mine");
    expect(state.rows.map((r) => r.cache_key)).toEqual(["r3"]);
    expect([...state.files]).toEqual(["theirs/r3.jpg"]);
  });
});
