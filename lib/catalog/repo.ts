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

/** Remove a store's products (removal rule), or only those no longer in its feed. */
export async function deleteStoreProducts(db: SupabaseClient, store: string, keepIds?: string[]) {
  let query = db.from("products").delete().eq("store", store);
  if (keepIds?.length) query = query.not("id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`);
  const { error } = await query;
  if (error) throw new Error(`Catalog delete failed: ${error.message}`);
}
