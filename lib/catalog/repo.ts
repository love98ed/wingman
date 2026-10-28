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

export async function loadCatalog(db: SupabaseClient): Promise<Product[]> {
  const { data, error } = await db.from("products").select("*");
  if (error) throw new Error(`Catalog read failed: ${error.message}`);
  return (data as Row[]).map(fromRow);
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
