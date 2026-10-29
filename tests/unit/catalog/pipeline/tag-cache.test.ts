import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ShopifyProduct } from "@/lib/catalog/pipeline/shopify";
import { sourceHash, TagCache } from "@/lib/catalog/pipeline/tag-cache";

const product: ShopifyProduct = {
  id: 1,
  title: "Linen Shirt",
  handle: "linen-shirt",
  body_html: "<p>Breathable linen.</p>",
  product_type: "Shirts",
  tags: ["linen"],
  updated_at: "2026-10-01T10:00:00+08:00",
  options: [],
  variants: [{ id: 11, title: "M", price: "120.00", available: true }],
  images: [{ src: "https://cdn.shopify.com/a.jpg?v=1" }],
};

describe("sourceHash", () => {
  it("ignores stock, price and updated_at, which change without the product changing", () => {
    const restocked = {
      ...product,
      updated_at: "2026-10-29T10:00:00+08:00",
      variants: [{ ...product.variants[0], available: false, price: "99.00" }],
      images: [{ src: "https://cdn.shopify.com/a.jpg?v=2" }],
    };
    expect(sourceHash(restocked)).toBe(sourceHash(product));
  });

  it("changes when what the tagger reads changes", () => {
    expect(sourceHash({ ...product, title: "Linen Shirt - Navy" })).not.toBe(sourceHash(product));
    expect(sourceHash({ ...product, tags: ["linen", "navy"] })).not.toBe(sourceHash(product));
    expect(sourceHash({ ...product, images: [{ src: "https://cdn.shopify.com/b.jpg" }] })).not.toBe(sourceHash(product));
  });
});

/** Just enough of Supabase for TagCache: one page of catalog_tags rows, and upserts recorded. */
function fakeDb(rows: Record<string, unknown>[]) {
  const upserts: Record<string, unknown>[][] = [];
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    range: async () => ({ data: rows, error: null }),
    upsert: async (batch: Record<string, unknown>[]) => (upserts.push(batch), { error: null }),
  };
  return { db: { from: () => query } as unknown as SupabaseClient, upserts };
}

const tag = { id: 1, menswear: true, category: "top", colour: "white", formality: "casual", occasions: ["date"] };
const stored = (overrides: Record<string, unknown> = {}) => ({
  product_id: "duxton.com-1",
  source_hash: sourceHash(product),
  tag,
  image_checked: true,
  image: "https://cdn.shopify.com/a.jpg",
  image_colour: "off-white",
  ...overrides,
});

describe("TagCache", () => {
  it("reuses a stored tag and image pick while the product is unchanged", async () => {
    const { db } = fakeDb([stored()]);
    const cache = await TagCache.load(db, "duxton.com");
    const entry = cache.entry({ ...product, updated_at: "2026-10-30T00:00:00+08:00" });
    expect(entry).toEqual({ tag, image: "https://cdn.shopify.com/a.jpg", imageColour: "off-white" });
    expect(cache.entry(product)).toBe(entry);
  });

  it("starts fresh when the product's text or photos changed", async () => {
    const { db } = fakeDb([stored()]);
    const cache = await TagCache.load(db, "duxton.com");
    expect(cache.entry({ ...product, title: "Linen Shirt - Navy" })).toEqual({});
  });

  it("tells 'image not checked yet' apart from 'checked, none usable'", async () => {
    const { db } = fakeDb([stored({ image_checked: false, image: null }), stored({ product_id: "duxton.com-2", image: null })]);
    const cache = await TagCache.load(db, "duxton.com");
    expect(cache.entry(product).image).toBeUndefined();
    expect(cache.entry({ ...product, id: 2 }).image).toBeNull();
  });

  it("saves only the entries touched since the last save", async () => {
    const { db, upserts } = fakeDb([]);
    const cache = await TagCache.load(db, "duxton.com");
    cache.entry(product).tag = tag as never;
    cache.entry({ ...product, id: 2 });
    cache.touch(product);
    await cache.save();
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toEqual([
      {
        product_id: "duxton.com-1",
        store: "duxton.com",
        source_hash: sourceHash(product),
        tag,
        image_checked: false,
        image: null,
        image_colour: null,
      },
    ]);
    await cache.save();
    expect(upserts).toHaveLength(1);
  });
});
