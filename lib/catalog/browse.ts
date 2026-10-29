/**
 * Browse: filter the in-stock catalog by category, tier, price, colour family, size and store.
 * Pure functions, shared by the API route and tests.
 */
import type { Category, Product, Tier } from "./types";

/** Colour families for the filter, checked in order: patterns and metals before plain colour words. */
const FAMILIES: [family: string, pattern: RegExp][] = [
  ["Pattern", /stripe|print|check|plaid|camo|paisley|multi|floral|\band\b|\bwith\b/],
  ["Metal", /gold|silver|gunmetal|steel|chrome/],
  ["Navy", /navy|midnight/],
  ["Black", /black|onyx|jet/],
  ["White", /white|cream|ivory|ecru|off-white/],
  ["Grey", /grey|gray|charcoal|ash|heather|slate/],
  ["Blue", /blue|indigo|chambray|teal|denim|aqua|turquoise/],
  ["Green", /green|olive|sage|forest|mint/],
  ["Beige", /beige|khaki|sand|taupe|stone|neutral|oat|natural/],
  ["Brown", /brown|walnut|chestnut|tan|coffee|cognac|auburn|pecan|mahogany|oak|snuff|rosewood|camel|copper|chocolate|mocha/],
  ["Red", /red|burgundy|maroon|oxblood|wine|crimson/],
  ["Pink", /pink|rose|blush/],
  ["Yellow", /yellow|mustard/],
  ["Orange", /orange|rust/],
  ["Purple", /purple|lilac|lavender|plum/],
];

export function colourFamily(colour: string): string {
  const c = colour.toLowerCase();
  return FAMILIES.find(([, re]) => re.test(c))?.[0] ?? "Other";
}

/** Stores write sizes many ways; "M/46", "MEDIUM" and "m" are all M, "EU 42" and "W32 L30" are 42 and 32. */
export function normaliseSize(size: string): string | null {
  const s = size.trim().toUpperCase();
  if (s === "DEFAULT TITLE" || s === "FREE" || s === "ONE SIZE") return "One size";
  if (s.startsWith("MADE TO MEASURE")) return null;
  const words: Record<string, string> = {
    "EXTRA SMALL": "XS",
    SMALL: "S",
    MEDIUM: "M",
    LARGE: "L",
    "EXTRA LARGE": "XL",
    "X-LARGE": "XL",
    "2XL": "XXL",
    XXXL: "3XL",
  };
  if (words[s]) return words[s];
  const letter = s.match(/^(XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL)\s*\/\s*\d+$/) ?? s.match(/^\d+\s*\/\s*(XXS|XS|S|M|L|XL|XXL|2XL|3XL)$/);
  if (letter) return words[letter[1]] ?? letter[1];
  const eu = s.match(/^EU\s*(\d+(\.5)?)$/);
  if (eu) return eu[1];
  const waist = s.match(/^W(\d+)\s*L\d+$/);
  if (waist) return waist[1];
  return s;
}

const LETTER_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

/** Letter sizes in wearing order, then numbers ascending, then anything else. */
export function compareSizes(a: string, b: string): number {
  const rank = (s: string) => {
    const letter = LETTER_ORDER.indexOf(s);
    if (letter >= 0) return [0, letter] as const;
    const n = parseFloat(s);
    return Number.isNaN(n) ? ([2, 0] as const) : ([1, n] as const);
  };
  const [ga, va] = rank(a);
  const [gb, vb] = rank(b);
  return ga - gb || va - vb || a.localeCompare(b);
}

/** In-stock sizes of a product, normalised. */
const productSizes = (p: Product) =>
  new Set(p.variants.filter((v) => v.available).flatMap((v) => normaliseSize(v.size) ?? []));

const PRICE_BANDS = {
  "under-100": [0, 100],
  "100-250": [100, 250],
  "250-500": [250, 500],
  "over-500": [500, Infinity],
} as const satisfies Record<string, readonly [number, number]>;
type PriceBand = keyof typeof PRICE_BANDS;

type BrowseFilter = {
  category: Category;
  tier?: Tier;
  price?: PriceBand;
  colour?: string;
  size?: string;
  store?: string;
  sort?: "price-asc" | "price-desc";
};

type Facets = {
  colours: { value: string; count: number }[];
  sizes: { value: string; count: number }[];
  stores: { value: string; label: string; count: number }[];
};

const MAX_SIZES = 16;

function matches(p: Product, f: BrowseFilter, skip?: "colour" | "size" | "store"): boolean {
  if (p.category !== f.category) return false;
  if (f.tier && p.tier !== f.tier) return false;
  if (f.price) {
    const [lo, hi] = PRICE_BANDS[f.price];
    if (p.price < lo || p.price >= hi) return false;
  }
  if (skip !== "colour" && f.colour && colourFamily(p.colour) !== f.colour) return false;
  if (skip !== "size" && f.size && !productSizes(p).has(f.size)) return false;
  if (skip !== "store" && f.store && p.store !== f.store) return false;
  return true;
}

/**
 * Products matching every filter, sorted, plus the options for the colour, size and store
 * filters. Each facet counts products matching the other filters, so picking a colour
 * doesn't hide the other colours.
 */
export function browse(products: Product[], f: BrowseFilter): { items: Product[]; facets: Facets } {
  const items = products.filter((p) => matches(p, f));
  if (f.sort === "price-desc") items.sort((a, b) => b.price - a.price);
  else items.sort((a, b) => a.price - b.price);

  const count = <K extends string>(values: Iterable<K>, into: Map<K, number>) => {
    for (const v of values) into.set(v, (into.get(v) ?? 0) + 1);
  };
  const colours = new Map<string, number>();
  const sizes = new Map<string, number>();
  const stores = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const p of products) {
    if (matches(p, f, "colour")) count([colourFamily(p.colour)], colours);
    if (matches(p, f, "size")) count(productSizes(p), sizes);
    if (matches(p, f, "store")) {
      count([p.store], stores);
      labels.set(p.store, p.storeName);
    }
  }
  const byCount = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
  return {
    items,
    facets: {
      colours: [...colours].sort(byCount).map(([value, count]) => ({ value, count })),
      // The most stocked sizes, then shown in wearing order
      sizes: [...sizes]
        .sort(byCount)
        .slice(0, MAX_SIZES)
        .sort((a, b) => compareSizes(a[0], b[0]))
        .map(([value, count]) => ({ value, count })),
      stores: [...stores].sort(byCount).map(([value, count]) => ({ value, label: labels.get(value)!, count })),
    },
  };
}
