import type { LookPick } from "@/lib/agent/schemas";
import { SLOTS, type Slot } from "@/lib/agent/slots";
import { displayName } from "@/lib/catalog/names";
import type { Formality, Occasion, Product } from "@/lib/catalog/types";
import { sha256 } from "@/lib/utils/hash";

/** How many candidates per slot Claude sees: enough choice, small prompt. */
const POOL_SIZE: Record<Slot, number> = { top: 30, outerwear: 12, bottom: 20, shoes: 20, watch: 12 };

/**
 * Largest share of a look's budget one piece may take, so the pool can still make a
 * full look under the cap. The shares overlap on purpose; the total is checked after.
 */
const BUDGET_SHARE: Record<Slot, number> = { top: 0.45, outerwear: 0.5, bottom: 0.4, shoes: 0.5, watch: 0.4 };

/** Formality levels a look may borrow from, nearest first. */
export function allowedFormalities(target: Formality): Formality[] {
  if (target === "casual") return ["casual", "smart-casual"];
  if (target === "formal") return ["formal", "smart-casual"];
  return ["smart-casual", "casual", "formal"];
}

export const isInStock = (p: Product) => p.variants.some((v) => v.available);

export type Pool = Record<Slot, Product[]>;

/**
 * In-stock candidates per slot, best match first: occasion tag, then exact formality.
 * Ties break on a hash of `seed` so the same request always sees the same pool.
 */
export function buildPool(
  products: Product[],
  opts: { occasion: Occasion; formality: Formality; maxBudget?: number; seed: string },
): Pool {
  const formalities = allowedFormalities(opts.formality);
  const pool = {} as Pool;
  for (const slot of SLOTS) {
    pool[slot] = products
      .filter(
        (p) =>
          p.category === slot &&
          isInStock(p) &&
          formalities.includes(p.formality) &&
          (opts.maxBudget == null || p.price <= opts.maxBudget * BUDGET_SHARE[slot]),
      )
      .map((p) => ({
        p,
        score: (p.occasions.includes(opts.occasion) ? 2 : 0) + (p.formality === opts.formality ? 1 : 0),
        tie: sha256(`${opts.seed}|${p.id}`),
      }))
      .sort((a, b) => b.score - a.score || a.tie.localeCompare(b.tie))
      .slice(0, POOL_SIZE[slot])
      .map(({ p }) => p);
  }
  return pool;
}

/** A candidate as Claude sees it: id | name | colour | formality | price | store. */
export const productLine = (p: Product) =>
  `${p.id} | ${p.name} | ${p.colour} | ${p.formality} | S$${p.price.toFixed(0)} | ${p.storeName}`;

/** One line per candidate for the selection prompt. */
export function poolLines(pool: Pool): string {
  return SLOTS.map((slot) => `## ${slot}\n${pool[slot].map(productLine).join("\n") || "(none)"}`).join("\n\n");
}

export type LookItems = Partial<Record<Slot, Product>>;

/** The products a pick names, in slot order. */
export function lookItems(pick: LookPick, pool: Pool): LookItems {
  const items: LookItems = {};
  for (const slot of SLOTS) {
    const id = pick[slot];
    const product = id ? pool[slot].find((p) => p.id === id) : undefined;
    if (product) items[slot] = product;
  }
  return items;
}

export const lookTotal = (items: LookItems) =>
  Math.round(Object.values(items).reduce((sum, p) => sum + (p?.price ?? 0), 0) * 100) / 100;

/**
 * Problems with Claude's picks, worded so they can be sent back for a retry.
 * Empty when every id is a real in-stock candidate in the right slot and totals fit the budget.
 */
export function pickErrors(
  picks: LookPick[],
  pool: Pool,
  opts: { maxBudget?: number; beard: string[] },
): string[] {
  const errors: string[] = [];
  picks.forEach((pick, i) => {
    const label = `Look ${i + 1} ("${pick.name}")`;
    for (const slot of SLOTS) {
      const id = pick[slot];
      const required = slot === "top" || slot === "bottom" || slot === "shoes";
      if (!id) {
        if (required) errors.push(`${label}: ${slot} is required.`);
        continue;
      }
      if (!pool[slot].some((p) => p.id === id)) errors.push(`${label}: "${id}" is not in the ${slot} list.`);
    }
    if (pick.beard && !opts.beard.includes(pick.beard)) errors.push(`${label}: beard "${pick.beard}" is not an allowed style.`);
    const total = lookTotal(lookItems(pick, pool));
    if (opts.maxBudget != null && total > opts.maxBudget) {
      errors.push(`${label}: total S$${total.toFixed(2)} is over the S$${opts.maxBudget} budget.`);
    }
  });
  const tops = picks.map((p) => p.top);
  if (new Set(tops).size !== tops.length) errors.push("Each look needs a different top.");
  const shown = picks.map(triedOn);
  if (new Set(shown).size !== shown.length) errors.push("Each look needs a different outerwear piece; two looks share one.");
  return errors;
}

/** The piece the try-on puts on him (outerwear over the top), so the one that makes looks look alike. */
const triedOn = (pick: LookPick) => pick.outerwear ?? pick.top;

/** Looks in order, dropping any that would show the same piece as an earlier one. Fewer looks beat repeats. */
export function distinctLooks(picks: LookPick[]): LookPick[] {
  const seen = new Set<string>();
  return picks.filter((pick) => {
    const key = triedOn(pick);
    if (seen.has(key) || seen.has(pick.top)) return false;
    seen.add(key).add(pick.top);
    return true;
  });
}

/**
 * The first `n` products in order, with at most `maxSame` sharing a product name, so a
 * shirt sold in eight colours can't fill every option. Colour variants still get through.
 */
export function varied(products: Product[], n: number, maxSame = 2): Product[] {
  const seen = new Map<string, number>();
  const out: Product[] = [];
  for (const p of products) {
    const key = `${p.store}|${displayName(p.name, p.storeName).toLowerCase()}`;
    const count = seen.get(key) ?? 0;
    if (count >= maxSame) continue;
    seen.set(key, count + 1);
    out.push(p);
    if (out.length === n) break;
  }
  return out;
}
