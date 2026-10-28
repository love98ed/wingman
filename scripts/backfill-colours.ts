/**
 * One-off: re-tag the colour of tops and outerwear from their try-on photo.
 * Text tags give multi-colour products one colour that the chosen photo may not show
 * (a red and blue plaid tagged "white"). Saves imageColour to fixtures/catalog-cache
 * so later catalog runs keep it, and updates the colour in Supabase directly.
 * Already backfilled products are skipped, so it is safe to re-run.
 *
 *   npm run catalog:colours [-- --store duxton.com]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { sizedUrl, TRY_ON_CATEGORIES } from "@/lib/catalog/images";
import { garmentColour, type ProductTag } from "@/lib/catalog/tag";
import { pool } from "@/lib/pool";
import { supabaseAdmin } from "@/lib/supabase/server";

const { values: args } = parseArgs({ options: { store: { type: "string" } } });

type CacheEntry = { name: string; tag?: ProductTag; image?: string | null; imageColour?: string };
const CACHE_DIR = path.join(process.cwd(), "fixtures", "catalog-cache");
/** Same small size the image check uses. */
const JUDGE_WIDTH = 640;

async function main() {
  const db = supabaseAdmin();
  const files = (await readdir(CACHE_DIR)).filter((f) => f.endsWith(".json") && (!args.store || f === `${args.store}.json`));
  const changes: { name: string; from: string; to: string }[] = [];
  let failed = 0;

  for (const file of files) {
    const domain = file.replace(/\.json$/, "");
    const cachePath = path.join(CACHE_DIR, file);
    const cache: Record<string, CacheEntry> = JSON.parse(await readFile(cachePath, "utf8"));
    const todo = Object.entries(cache).filter(
      ([, e]) => e.image && e.tag?.category && TRY_ON_CATEGORIES.includes(e.tag.category) && !e.imageColour,
    );
    if (todo.length === 0) continue;
    console.info(`${domain}: ${todo.length} to check`);

    let done = 0;
    await pool(todo, 16, async ([shopifyId, entry]) => {
      try {
        const colour = await garmentColour(sizedUrl(entry.image!, JUDGE_WIDTH));
        entry.imageColour = colour;
        const { error } = await db.from("products").update({ colour }).eq("id", `${domain}-${shopifyId}`);
        if (error) throw new Error(error.message);
        if (colour !== entry.tag!.colour.toLowerCase()) changes.push({ name: entry.name, from: entry.tag!.colour, to: colour });
      } catch (err) {
        failed++;
        console.warn(`  ${entry.name}: ${(err as Error).message}`);
      }
      if (++done % 50 === 0) {
        console.info(`  ${done}/${todo.length}`);
        await writeFile(cachePath, JSON.stringify(cache, null, 2));
      }
    });
    await writeFile(cachePath, JSON.stringify(cache, null, 2));
  }

  console.info(`\n${changes.length} colours changed, ${failed} failed. Examples:`);
  for (const c of changes.slice(0, 25)) console.info(`  ${c.from.padEnd(14)} -> ${c.to.padEnd(26)} ${c.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
