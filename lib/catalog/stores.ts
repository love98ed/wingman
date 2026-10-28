import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CATEGORIES } from "./types";


export const StoreSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1),
  fills: z.array(z.enum(CATEGORIES)),
  /** Set by scripts/check-stores.ts. Unverified stores are skipped by the catalog fetch. */
  verified: z.boolean().optional(),
  shopifyProof: z.string().optional(),
  currency: z.string().length(3).optional(),
  productCountEstimate: z.string().optional(),
  checkedAt: z.string().optional(),
  /** Why the last check was inconclusive (e.g. rate limited), if it was. */
  pendingReason: z.string().optional(),
});
export type Store = z.infer<typeof StoreSchema>;

export const RemovedStoreSchema = z.object({
  domain: z.string(),
  name: z.string(),
  reason: z.string(),
  removedAt: z.string(),
});
export type RemovedStore = z.infer<typeof RemovedStoreSchema>;

const FIXTURES = path.join(process.cwd(), "fixtures");
export const STORES_FILE = path.join(FIXTURES, "stores.json");
export const REMOVED_FILE = path.join(FIXTURES, "stores-removed.json");

export async function readStores(): Promise<Store[]> {
  return z.array(StoreSchema).parse(JSON.parse(await readFile(STORES_FILE, "utf8")));
}

export async function readRemoved(): Promise<RemovedStore[]> {
  try {
    return z.array(RemovedStoreSchema).parse(JSON.parse(await readFile(REMOVED_FILE, "utf8")));
  } catch {
    return [];
  }
}

export async function writeStores(stores: Store[]) {
  await writeFile(STORES_FILE, `${JSON.stringify(stores, null, 2)}\n`);
}

/** CLAUDE.md 5b removal rule: log a removed store with the reason and date. */
export async function appendRemoved(entry: RemovedStore) {
  const removed = await readRemoved();
  removed.push(entry);
  await writeFile(REMOVED_FILE, `${JSON.stringify(removed, null, 2)}\n`);
}
