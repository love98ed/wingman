/**
 * Build the product catalog from verified stores (CLAUDE.md sections 5 and 5b):
 * fetch products.json, keep menswear, tag with Claude Haiku, convert to SGD,
 * pick a try-on image, assign relative tiers across the whole catalog, upsert.
 *
 *   npm run catalog:fetch                       all verified stores
 *   npm run catalog:fetch -- --store duxton.com one store
 *   npm run catalog:fetch -- --store duxton.com --from-file fixtures/shopify/duxton.com.json
 *   add --dry-run to skip all writes (database and store files)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildProduct, inStock, type UntieredProduct } from "@/lib/catalog/build";
import { prefilterMenswear } from "@/lib/catalog/filter";
import { UnknownCurrencyError } from "@/lib/catalog/fx";
import { rankImages, sizedUrl, TRY_ON_CATEGORIES, usableForTryOn } from "@/lib/catalog/images";
import { PoliteFetcher, RateLimitedError } from "@/lib/catalog/polite-fetch";
import { deleteStoreProducts, loadCatalog, upsertProducts } from "@/lib/catalog/repo";
import { fetchAllProducts, parseProductsPage } from "@/lib/catalog/shopify";
import { appendRemoved, readStores, writeStores, type Store } from "@/lib/catalog/stores";
import { pool } from "@/lib/pool";
import { judgeImage, tagBatch, TAG_BATCH_SIZE, type ProductTag } from "@/lib/catalog/tag";
import { assignTiers, tierCounts } from "@/lib/catalog/tiers";
import { CATEGORIES, TIERS, type Category, type Product, type ShopifyProduct } from "@/lib/catalog/types";
import { supabaseAdmin } from "@/lib/supabase/server";

const { values: args } = parseArgs({
  options: {
    store: { type: "string" },
    "from-file": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = args["dry-run"];
const today = new Date().toISOString().slice(0, 10);

type Summary = { store: string; fetched: number; prefiltered: number; menswear: number; kept: number; noImage: number; note?: string };

/** Width Claude sees when judging a photo; small is faster and plenty to spot bare skin. */
const JUDGE_WIDTH = 640;

/** The try-on image, plus its colour as Claude saw it (try-on categories only). */
async function chooseImage(product: ShopifyProduct, category: Category): Promise<{ image: string | null; colour?: string }> {
  const ranked = rankImages(product);
  if (ranked.length === 0) return { image: null };
  if (!TRY_ON_CATEGORIES.includes(category)) return { image: sizedUrl(ranked[0].src) };
  for (const candidate of ranked.slice(0, 2)) {
    const verdict = await judgeImage(sizedUrl(candidate.src, JUDGE_WIDTH)).catch(() => null);
    if (verdict && usableForTryOn(verdict)) return { image: sizedUrl(candidate.src), colour: verdict.colour?.trim().toLowerCase() };
  }
  return { image: null };
}

/**
 * Per-store cache (fixtures/catalog-cache) of tags and image decisions, keyed by Shopify product id and
 * updated_at. Saved as work progresses, so an interrupted run resumes where it
 * stopped and later refreshes only pay for changed products.
 */
/** name and url are for people reading the file; the pipeline keys on id and updatedAt. */
type CacheEntry = {
  name: string;
  url: string;
  updatedAt: string;
  tag?: ProductTag;
  image?: string | null;
  /** Colour seen in the try-on image; wins over tag.colour (see scripts/backfill-colours.ts). */
  imageColour?: string;
};
type StoreCache = Record<string, CacheEntry>;
// Committed so teammates can resume a fetch on another machine.
const CACHE_DIR = path.join(process.cwd(), "fixtures", "catalog-cache");

async function loadCache(domain: string): Promise<StoreCache> {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, `${domain}.json`), "utf8"));
  } catch {
    return {};
  }
}

async function saveCache(domain: string, cache: StoreCache) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path.join(CACHE_DIR, `${domain}.json`), JSON.stringify(cache, null, 2));
}

async function processStore(store: Store, raw: ShopifyProduct[]) {
  const summary: Summary = { store: store.domain, fetched: raw.length, prefiltered: 0, menswear: 0, kept: 0, noImage: 0 };
  const candidates = raw.filter((p) => prefilterMenswear(p).keep);
  summary.prefiltered = candidates.length;

  const cache = await loadCache(store.domain);
  // Always return the same object for a product: parallel work assigns into it.
  const entry = (p: ShopifyProduct) => {
    const e = cache[p.id];
    if (e && e.updatedAt === p.updated_at) {
      e.name ??= p.title; // backfill entries cached before name and url existed
      e.url ??= `https://${store.domain}/products/${p.handle}`;
      return e;
    }
    return (cache[p.id] = { name: p.title, url: `https://${store.domain}/products/${p.handle}`, updatedAt: p.updated_at });
  };

  // 1. Tag products without a current tag, 4 batches at a time.
  const untagged = candidates.filter((p) => !entry(p).tag);
  const batches: ShopifyProduct[][] = [];
  for (let i = 0; i < untagged.length; i += TAG_BATCH_SIZE) batches.push(untagged.slice(i, i + TAG_BATCH_SIZE));
  let tagged = 0;
  await pool(batches, 4, async (batch) => {
    for (const tag of await tagBatch(batch)) {
      const product = batch.find((p) => p.id === tag.id);
      if (product) entry(product).tag = tag;
    }
    tagged += batch.length;
    console.info(`  tagged ${tagged}/${untagged.length}`);
    await saveCache(store.domain, cache);
  });

  // 2. Pick images for menswear products without a decision, 16 at a time.
  const menswear = candidates.filter((p) => entry(p).tag?.menswear && entry(p).tag?.category);
  const undecided = menswear.filter((p) => entry(p).image === undefined);
  let judged = 0;
  await pool(undecided, 16, async (p) => {
    const { image, colour } = await chooseImage(p, entry(p).tag!.category!);
    entry(p).image = image;
    if (colour) entry(p).imageColour = colour;
    if (++judged % 20 === 0 || judged === undecided.length) {
      console.info(`  images ${judged}/${undecided.length}`);
      await saveCache(store.domain, cache);
    }
  });
  await saveCache(store.domain, cache);

  const products: UntieredProduct[] = [];
  for (const p of menswear) {
    const { tag, image, imageColour } = entry(p);
    if (!image) {
      summary.noImage++;
      continue;
    }
    products.push(buildProduct(store, p, { ...tag!, category: tag!.category!, colour: imageColour ?? tag!.colour }, image));
  }
  summary.menswear = menswear.length;
  summary.kept = products.length;
  return { products, summary };
}

async function removeStore(store: Store, reason: string, stores: Store[]) {
  console.info(`  removing ${store.domain}: ${reason}`);
  if (dryRun) return stores;
  const remaining = stores.filter((s) => s.domain !== store.domain);
  await writeStores(remaining);
  await appendRemoved({ domain: store.domain, name: store.name, reason, removedAt: today });
  await deleteStoreProducts(supabaseAdmin(), store.domain);
  return remaining;
}

async function main() {
  const db = supabaseAdmin();
  let stores = await readStores();
  const fromFile = args["from-file"];
  const targets = args.store ? stores.filter((s) => s.domain === args.store) : stores.filter((s) => s.verified);
  if (args.store && targets.length === 0) throw new Error(`${args.store} is not in fixtures/stores.json`);
  if (!fromFile) {
    const unverified = targets.filter((s) => !s.verified);
    if (unverified.length) throw new Error(`Run npm run stores:check first; unverified: ${unverified.map((s) => s.domain).join(", ")}`);
  }
  if (targets.length === 0) throw new Error("No verified stores. Run npm run stores:check first.");

  const existing = await loadCatalog(db);
  const http = new PoliteFetcher({ log: console.info });
  const refreshed = new Map<string, UntieredProduct[]>();
  const summaries: Summary[] = [];

  for (const store of targets) {
    console.info(`\n${store.name} (${store.domain})`);
    if (!store.currency) console.info(`  currency unknown, assuming SGD`);
    let raw: ShopifyProduct[];
    try {
      raw = fromFile ? parseProductsPage(JSON.parse(await readFile(fromFile, "utf8"))) : await fetchAllProducts(http, store.domain);
    } catch (err) {
      if (err instanceof RateLimitedError) {
        summaries.push({ store: store.domain, fetched: 0, prefiltered: 0, menswear: 0, kept: 0, noImage: 0, note: "rate limited, skipped" });
        continue;
      }
      stores = await removeStore(store, `fetch failed: ${(err as Error).message}`, stores);
      continue;
    }
    try {
      console.info(`  ${raw.length} products fetched`);
      const { products, summary } = await processStore(store, raw);
      summaries.push(summary);
      if (products.length === 0) {
        stores = await removeStore(store, "zero menswear products after filtering", stores);
        continue;
      }
      refreshed.set(store.domain, products);
    } catch (err) {
      if (err instanceof UnknownCurrencyError) {
        summaries.push({ store: store.domain, fetched: raw.length, prefiltered: 0, menswear: 0, kept: 0, noImage: 0, note: err.message });
        continue;
      }
      throw err;
    }
  }

  // Tiers are relative to the whole catalog, so recompute them over every store.
  const untouched = existing.filter((p) => !refreshed.has(p.store) && stores.some((s) => s.domain === p.store));
  const all: UntieredProduct[] = [...untouched, ...[...refreshed.values()].flat()];
  const tierInput = all.map((p) => ({ id: p.id, category: p.category, price: p.price, inStock: inStock(p) }));
  const { tiers, cutoffs } = assignTiers(tierInput);
  const catalog: Product[] = all.map((p) => ({ ...p, tier: tiers.get(p.id)! }));

  if (!dryRun) {
    await upsertProducts(db, catalog);
    for (const [store, products] of refreshed) await deleteStoreProducts(db, store, products.map((p) => p.id));
  }

  console.info(`\n${"Store".padEnd(28)}${"Fetched".padEnd(9)}${"Prefilter".padEnd(11)}${"Menswear".padEnd(10)}${"No image".padEnd(10)}Kept`);
  for (const s of summaries) {
    console.info(
      `${s.store.padEnd(28)}${String(s.fetched).padEnd(9)}${String(s.prefiltered).padEnd(11)}${String(s.menswear).padEnd(10)}${String(s.noImage).padEnd(10)}${s.kept}${s.note ? `  (${s.note})` : ""}`,
    );
  }

  const counts = tierCounts(tierInput, tiers);
  console.info(`\nIn-stock items by tier${dryRun ? " (dry run, nothing written)" : ""}`);
  console.info(`${"Category".padEnd(12)}${TIERS.map((t) => t.padEnd(9)).join("")}Cutoffs (SGD)`);
  for (const category of CATEGORIES) {
    const row = counts[category];
    const c = cutoffs.get(category);
    if (!row || !c) continue;
    const cut = `${c.mode}: budget <= ${c.budgetMax.toFixed(0)}, mid <= ${c.midMax.toFixed(0)}`;
    console.info(`${category.padEnd(12)}${TIERS.map((t) => String(row[t]).padEnd(9)).join("")}${cut}`);
  }

  // Step 3 done criteria: >= 5 per tier in tops, bottoms and shoes; >= 3 watches.
  const gaps: string[] = [];
  for (const category of ["top", "bottom", "shoes"] as const) {
    for (const tier of TIERS) {
      const n = counts[category]?.[tier] ?? 0;
      if (n < 5) gaps.push(`${category}/${tier}: ${n} (need 5)`);
    }
  }
  const watches = Object.values(counts.watch ?? {}).reduce((a, b) => a + b, 0);
  if (watches < 3) gaps.push(`watch: ${watches} (need 3)`);
  console.info(gaps.length ? `\nGaps: ${gaps.join("; ")}` : "\nNo gaps: every tier is covered.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
