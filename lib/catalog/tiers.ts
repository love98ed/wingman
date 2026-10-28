import type { Category, Tier } from "./types";

/** CLAUDE.md section 5 fallback thresholds in SGD: [budget below, luxury above]. */
export const FALLBACK_THRESHOLDS: Record<Category, [number, number]> = {
  top: [80, 200],
  bottom: [80, 200],
  outerwear: [150, 400],
  shoes: [150, 350],
  watch: [300, 700],
  accessory: [50, 150],
  glasses: [50, 150],
};

/** Below this many in-stock items, a category uses the fixed thresholds. */
export const MIN_ITEMS_FOR_RELATIVE = 6;

export type TierInput = { id: string; category: Category; price: number; inStock: boolean };

export type CategoryCutoffs = {
  category: Category;
  mode: "relative" | "fallback";
  /** Prices at or below this are budget. */
  budgetMax: number;
  /** Prices at or below this (and above budgetMax) are mid; above is luxury. */
  midMax: number;
  inStockCount: number;
};

/** Linear-interpolated percentile of sorted values (0 <= q <= 1). */
export function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Cutoffs per category from in-stock prices. Uses price percentiles (not counts),
 * so equal prices always land in the same tier.
 */
export function categoryCutoffs(items: TierInput[]): Map<Category, CategoryCutoffs> {
  const byCategory = new Map<Category, number[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    if (item.inStock) byCategory.get(item.category)!.push(item.price);
  }
  const out = new Map<Category, CategoryCutoffs>();
  for (const [category, prices] of byCategory) {
    prices.sort((a, b) => a - b);
    if (prices.length >= MIN_ITEMS_FOR_RELATIVE) {
      out.set(category, {
        category,
        mode: "relative",
        budgetMax: percentile(prices, 1 / 3),
        midMax: percentile(prices, 2 / 3),
        inStockCount: prices.length,
      });
    } else {
      const [budgetBelow, luxuryAbove] = FALLBACK_THRESHOLDS[category];
      // Fallback table: budget < low, mid low..high inclusive, luxury > high.
      out.set(category, {
        category,
        mode: "fallback",
        budgetMax: budgetBelow - 0.01,
        midMax: luxuryAbove,
        inStockCount: prices.length,
      });
    }
  }
  return out;
}

export function tierFor(price: number, cutoffs: CategoryCutoffs): Tier {
  if (price <= cutoffs.budgetMax) return "budget";
  if (price <= cutoffs.midMax) return "mid";
  return "luxury";
}

/** Recompute every tier (call after each catalog refresh). Out-of-stock items use their category's cutoffs. */
export function assignTiers(items: TierInput[]): { tiers: Map<string, Tier>; cutoffs: Map<Category, CategoryCutoffs> } {
  const cutoffs = categoryCutoffs(items);
  const tiers = new Map<string, Tier>();
  for (const item of items) tiers.set(item.id, tierFor(item.price, cutoffs.get(item.category)!));
  return { tiers, cutoffs };
}

/** Category x tier counts of in-stock items, for the post-refresh log. */
export function tierCounts(items: TierInput[], tiers: Map<string, Tier>) {
  const counts: Partial<Record<Category, Record<Tier, number>>> = {};
  for (const item of items) {
    if (!item.inStock) continue;
    const row = (counts[item.category] ??= { budget: 0, mid: 0, luxury: 0 });
    row[tiers.get(item.id)!]++;
  }
  return counts;
}
