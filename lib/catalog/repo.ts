import type { SupabaseClient } from "@supabase/supabase-js";
import { inStock } from "./build";
import type { Product } from "./types";

type Row = {
  id: string;
  store: string;
  store_name: string;
  name: string;
  price: number;
  currency: "SGD";
  original_price: number;
  original_currency: string;
  tier: Product["tier"];
  category: Product["category"];
  colour: string;
  formality: Product["formality"];
  occasions: Product["occasions"];
  image: string;
  images: string[];
  url: string;
  variants: Product["variants"];
  in_stock: boolean;
  updated_at: string;
};

export function toRow(p: Product): Row {
  return {
    id: p.id,
    store: p.store,
    store_name: p.storeName,
    name: p.name,
    price: p.price,
    currency: p.currency,
    original_price: p.originalPrice,
    original_currency: p.originalCurrency,
    tier: p.tier,
    category: p.category,
    colour: p.colour,
    formality: p.formality,
    occasions: p.occasions,
    image: p.image,
    images: p.images,
    url: p.url,
    variants: p.variants,
    in_stock: inStock(p),
    updated_at: p.updatedAt,
  };
}

export function fromRow(r: Row): Product {
  return {
    id: r.id,
    store: r.store,
    storeName: r.store_name,
    name: r.name,
    price: Number(r.price),
    currency: "SGD",
    tier: r.tier,
    category: r.category,
    originalPrice: Number(r.original_price),
    originalCurrency: r.original_currency,
    colour: r.colour,
    formality: r.formality,
    occasions: r.occasions,
    image: r.image,
    images: r.images,
    url: r.url,
    variants: r.variants,
    updatedAt: r.updated_at,
  };
}

/** Supabase returns at most 1,000 rows per request, so read in pages. */
const PAGE = 1000;

export type CatalogFilter = {
  inStock?: boolean;
  tier?: Product["tier"];
  tiers?: Product["tier"][];
  categories?: Product["category"][];
  formalities?: Product["formality"][];
  ids?: string[];
};

export async function loadCatalog(db: SupabaseClient, filter: CatalogFilter = {}): Promise<Product[]> {
  const out: Product[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from("products").select("*").order("id");
    if (filter.inStock) query = query.eq("in_stock", true);
    if (filter.tier) query = query.eq("tier", filter.tier);
    if (filter.tiers) query = query.in("tier", filter.tiers);
    if (filter.categories) query = query.in("category", filter.categories);
    if (filter.formalities) query = query.in("formality", filter.formalities);
    if (filter.ids) query = query.in("id", filter.ids);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`Catalog read failed: ${error.message}`);
    out.push(...(data as Row[]).map(fromRow));
    if (data.length < PAGE) return out;
  }
}

export async function upsertProducts(db: SupabaseClient, products: Product[]) {
  for (let i = 0; i < products.length; i += 500) {
    const { error } = await db.from("products").upsert(products.slice(i, i + 500).map(toRow));
    if (error) throw new Error(`Catalog upsert failed: ${error.message}`);
  }
}

/** Ids per delete request: a long `in (...)` list goes in the URL, which has a length limit. */
const DELETE_BATCH = 100;

/**
 * Remove a store's products (removal rule), or only those no longer in its feed. Returns how many
 * were removed. The stale ids are worked out here rather than sent as one `not in (...)` list,
 * which is too long for a URL once a store has a few hundred products.
 */
export async function deleteStoreProducts(db: SupabaseClient, store: string, keepIds?: string[]): Promise<number> {
  if (!keepIds?.length) {
    const { error, count } = await db.from("products").delete({ count: "exact" }).eq("store", store);
    if (error) throw new Error(`Catalog delete failed: ${error.message}`);
    return count ?? 0;
  }
  const keep = new Set(keepIds);
  const stale: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("products").select("id").eq("store", store).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`Catalog read failed: ${error.message}`);
    stale.push(...data.map((r) => r.id as string).filter((id) => !keep.has(id)));
    if (data.length < PAGE) break;
  }
  for (let i = 0; i < stale.length; i += DELETE_BATCH) {
    const { error } = await db.from("products").delete().in("id", stale.slice(i, i + DELETE_BATCH));
    if (error) throw new Error(`Catalog delete failed: ${error.message}`);
  }
  return stale.length;
}
