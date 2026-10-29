import { describe, expect, it } from "vitest";
import type { ShopifyProduct } from "@/lib/catalog/pipeline/shopify";
import { sourceHash } from "@/lib/catalog/pipeline/tag-cache";

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
