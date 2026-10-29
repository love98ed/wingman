/**
 * Build the product catalog from verified stores (CLAUDE.md sections 5 and 5b):
 * fetch products.json, keep menswear, tag with Claude Haiku, convert to SGD,
 * pick a try-on image, assign relative tiers across the whole catalog, upsert.
 *
 *   npm run catalog:fetch                       all verified stores
 *   npm run catalog:fetch -- --store duxton.com one store
 *   npm run catalog:fetch -- --store duxton.com --from-file fixtures/shopify/duxton.com.json
 *   add --dry-run to skip all writes (database and store files)
 *
 * Needs supabase/migrations/0002_catalog_tags.sql for the tag cache.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { buildProduct, inStock, type UntieredProduct } from "@/lib/catalog/pipeline/build";
import { prefilterMenswear } from "@/lib/catalog/pipeline/filter";
import { UnknownCurrencyError } from "@/lib/catalog/pipeline/fx";
import { rankImages, sizedUrl, TRY_ON_CATEGORIES, usableForTryOn } from "@/lib/catalog/pipeline/images";
import { PoliteFetcher, RateLimitedError } from "@/lib/catalog/pipeline/polite-fetch";
import { fetchAllProducts, parseProductsPage, type ShopifyProduct } from "@/lib/catalog/pipeline/shopify";
import { appendRemoved, readStores, writeStores, type Store } from "@/lib/catalog/pipeline/stores";
import { judgeImage, tagBatch, TAG_BATCH_SIZE } from "@/lib/catalog/pipeline/tag";
import { TagCache } from "@/lib/catalog/pipeline/tag-cache";
import { assignTiers, tierCounts } from "@/lib/catalog/pipeline/tiers";
import { deleteStoreProducts, loadCatalog, upsertProducts } from "@/lib/catalog/repo";
import { CATEGORIES, TIERS, type Category, type Product } from "@/lib/catalog/types";
import { supabaseAdmin } from "@/lib/supabase/server";
import { pool } from "@/lib/utils/pool";

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

async function processStore(store: Store, raw: ShopifyProduct[]) {
  const summary: Summary = { store: store.domain, fetched: raw.length, prefiltered: 0, menswear: 0, kept: 0, noImage: 0 };
  const candidates = raw.filter((p) => prefilterMenswear(p).keep);
  summary.prefiltered = candidates.length;

  // Tags and image picks persist in catalog_tags, so an interrupted run resumes and later
  // refreshes only pay for products whose text or photos changed.
  const cache = await TagCache.load(supabaseAdmin(), store.domain);
  const entry = (p: ShopifyProduct) => cache.entry(p);
  const save = () => (dryRun ? Promise.resolve() : cache.save());

  // 1. Tag products without a current tag, 4 batches at a time.
  const untagged = candidates.filter((p) => !entry(p).tag);
  const batches: ShopifyProduct[][] = [];
  for (let i = 0; i < untagged.length; i += TAG_BATCH_SIZE) batches.push(untagged.slice(i, i + TAG_BATCH_SIZE));
  let tagged = 0;
  await pool(batches, 4, async (batch) => {
    for (const tag of await tagBatch(batch)) {
      const product = batch.find((p) => p.id === tag.id);
      if (product) {
        entry(product).tag = tag;
        cache.touch(product);
      }
    }
    tagged += batch.length;
    console.info(`  tagged ${tagged}/${untagged.length}`);
    await save();
  });

  // 2. Pick images for menswear products without a decision, 16 at a time.
  const menswear = candidates.filter((p) => entry(p).tag?.menswear && entry(p).tag?.category);
  const undecided = menswear.filter((p) => entry(p).image === undefined);
  let judged = 0;
  await pool(undecided, 16, async (p) => {
    const { image, colour } = await chooseImage(p, entry(p).tag!.category!);
    entry(p).image = image;
    if (colour) entry(p).imageColour = colour;
    cache.touch(p);
    if (++judged % 20 === 0 || judged === undecided.length) {
      console.info(`  images ${judged}/${undecided.length}`);
      await save();
    }
  });
  await save();

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
    for (const [store, products] of refreshed) {
      const removed = await deleteStoreProducts(db, store, products.map((p) => p.id));
      if (removed) console.info(`${store}: removed ${removed} products no longer in the feed`);
    }
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
