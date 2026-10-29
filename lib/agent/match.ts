import { sha256 } from "@/lib/hash";
import type { Product, Tier } from "@/lib/catalog/types";
import { isInStock, productLine, SLOTS, type LookItems, type Slot } from "./catalog";
import type { TierPick } from "./schemas";

/** How many same-tier stand-ins per slot Claude chooses from. */
const CANDIDATES_PER_SLOT = 15;

const STOP_WORDS = new Set(["the", "and", "with", "for", "men", "mens", "man", "new", "edition", "limited"]);

/** Lowercase name words, plurals folded, so "Linen Shirts" and "linen shirt" overlap. */
export function nameWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
      .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w)),
  );
}

/** 1 for the same colour, 0.5 for a shared word ("navy" and "navy blue"), else 0. */
export function colourMatch(a: string, b: string): number {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x === y) return 1;
  const words = new Set(x.split(/[\s/-]+/));
  return y.split(/[\s/-]+/).some((w) => words.has(w)) ? 0.5 : 0;
}

/** How closely `p` keeps the style direction of `anchor`: colour first, then cut (name words), then formality. */
export function similarity(anchor: Product, p: Product): number {
  let shared = 0;
  const words = nameWords(anchor.name);
  for (const w of nameWords(p.name)) if (words.has(w)) shared++;
  return colourMatch(anchor.colour, p.colour) * 3 + Math.min(shared, 3) + (p.formality === anchor.formality ? 2 : 0);
}

export type TierPool = Partial<Record<Slot, Product[]>>;

/**
 * For each slot the look fills, the in-stock products of `tier` in the same category,
 * closest to the original piece first. Ties break on a hash of `seed` so results repeat.
 */
export function tierPool(look: LookItems, products: Product[], tier: Tier, seed: string): TierPool {
  const pool: TierPool = {};
  for (const slot of SLOTS) {
    const anchor = look[slot];
    if (!anchor) continue;
    pool[slot] = products
      .filter((p) => p.category === slot && p.tier === tier && isInStock(p))
      .map((p) => ({ p, score: p.id === anchor.id ? Infinity : similarity(anchor, p), tie: sha256(`${seed}|${p.id}`) }))
      .sort((a, b) => b.score - a.score || a.tie.localeCompare(b.tie))
      .slice(0, CANDIDATES_PER_SLOT)
      .map(({ p }) => p);
  }
  return pool;
}

/** Candidate lines for the matching prompt, one section per slot. */
export function tierPoolLines(pool: TierPool): string {
  return SLOTS.filter((slot) => pool[slot])
    .map((slot) => `### ${slot}\n${pool[slot]!.map(productLine).join("\n") || "(none)"}`)
    .join("\n");
}

/** Problems with one tier's picks, worded for a retry. Empty when every filled slot names a listed candidate. */
export function tierPickErrors(pick: TierPick, pool: TierPool): string[] {
  const errors: string[] = [];
  for (const slot of SLOTS) {
    const candidates = pool[slot];
    const id = pick[slot];
    if (!candidates) {
      if (id) errors.push(`${pick.tier}: the look has no ${slot}, so ${slot} must be null.`);
      continue;
    }
    if (!id) {
      if (candidates.length) errors.push(`${pick.tier}: ${slot} is required.`);
      continue;
    }
    if (!candidates.some((p) => p.id === id)) errors.push(`${pick.tier}: "${id}" is not in the ${pick.tier} ${slot} list.`);
  }
  return errors;
}

/**
 * The products for one tier: Claude's pick where it is valid, otherwise the closest candidate.
 * A slot with no candidates in this tier keeps the original piece, so the look stays whole.
 */
export function resolveTier(look: LookItems, pool: TierPool, pick?: TierPick): LookItems {
  const items: LookItems = {};
  for (const slot of SLOTS) {
    const anchor = look[slot];
    if (!anchor) continue;
    const candidates = pool[slot] ?? [];
    items[slot] = candidates.find((p) => p.id === pick?.[slot]) ?? candidates[0] ?? anchor;
  }
  return items;
}
