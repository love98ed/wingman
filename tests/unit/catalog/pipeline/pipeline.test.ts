import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProduct, listPrice } from "@/lib/catalog/pipeline/build";
import { prefilterMenswear } from "@/lib/catalog/pipeline/filter";
import { toSgd, UnknownCurrencyError } from "@/lib/catalog/pipeline/fx";
import { imageScore, rankImages, sizedUrl, usableForTryOn } from "@/lib/catalog/pipeline/images";
import { parseProductsPage, variantSize, type ShopifyProduct } from "@/lib/catalog/pipeline/shopify";
import { ProductTagSchema, TagBatchSchema } from "@/lib/catalog/pipeline/tag";

const duxton = parseProductsPage(JSON.parse(readFileSync("fixtures/shopify/duxton.com.json", "utf8")));
const byTitle = (t: string) => duxton.find((p) => p.title === t)!;

function product(overrides: Partial<ShopifyProduct> = {}): ShopifyProduct {
  return {
    id: 1,
    title: "Linen Shirt",
    handle: "linen-shirt",
    tags: [],
    updated_at: "2026-10-01T00:00:00Z",
    options: [{ name: "Size", position: 1 }],
    variants: [{ id: 11, title: "M", price: "100.00", available: true, option1: "M" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/x/shirt.jpg", width: 1600, height: 2000, position: 1 }],
    ...overrides,
  };
}

describe("fx", () => {
  it("converts to SGD and rounds to cents", () => {
    expect(toSgd(100, "SGD")).toBe(100);
    expect(toSgd(100, "USD")).toBe(130);
    expect(toSgd(9.99, "usd")).toBe(12.99);
  });
  it("throws on an unknown currency", () => {
    expect(() => toSgd(1, "XYZ")).toThrow(UnknownCurrencyError);
  });
});

describe("menswear prefilter on real Duxton data", () => {
  it("parses all 97 products", () => expect(duxton.length).toBe(97));

  it.each([
    "Regular Fit Button Up Shirt - Brown Floral",
    "Relaxed Fit Camp Collar Shirt - Beach Palms",
    "Basic Pants",
  ])("keeps %s", (title) => expect(prefilterMenswear(byTitle(title)).keep).toBe(true));

  it.each([
    "Crop Top",
    "Bubble Skirt",
    "Kaftan Dress",
    "Aura Pajamas Set",
    "Kids Basic Tank",
    "Embroidered Pocket Tee - Cuddle Monster",
    "Fight Like A Girl Tee - Malala Yousafzai",
  ])("drops %s", (title) => {
    expect(prefilterMenswear(byTitle(title)).keep).toBe(false);
  });

  it("drops kids items by their sizes even without a kids keyword", () => {
    const tee = product({
      title: "Printed Tee",
      variants: ["1 Y", "3 Y", "5 Y"].map((size, i) => ({ id: i, title: size, price: "39", available: true, option1: size })),
    });
    expect(prefilterMenswear(tee)).toEqual({ keep: false, reason: "kids sizes" });
  });

  it("drops the gift card", () => {
    const gift = duxton.find((p) => p.product_type === "Gift Card")!;
    expect(prefilterMenswear(gift).keep).toBe(false);
  });
});

describe("image selection heuristics", () => {
  const img = (name: string, extra: Partial<ShopifyProduct["images"][number]> = {}) => ({
    src: `https://cdn.shopify.com/s/files/1/0098/files/${name}`,
    width: 1600,
    height: 2400,
    ...extra,
  });

  it("prefers front and flat-lay shots over back views and size charts", () => {
    expect(imageScore(img("Shirt_Front.png"), 2)).toBeGreaterThan(imageScore(img("Shirt_Back.png"), 0));
    expect(imageScore(img("flatlay.jpg"), 3)).toBeGreaterThan(imageScore(img("DSC0001.jpg"), 0));
  });

  it("rejects tiny images and size charts", () => {
    const p = product({
      images: [
        img("ProductMeasurementGuide_Top-Shirts.png", { width: 1920, height: 1080 }),
        img("thumb.jpg", { width: 300, height: 400 }),
        img("Shirt_Front.png"),
      ],
    });
    expect(rankImages(p).map((i) => i.src.split("/").pop())).toEqual(["Shirt_Front.png"]);
  });

  it("ranks Duxton's front shot first for Retro Spade", () => {
    const first = rankImages(byTitle("Regular Fit Camp Collar Shirt - Retro Spade"))[0];
    expect(first.src).toContain("_Front.png");
  });

  it("asks Shopify's CDN for a try-on sized copy", () => {
    expect(sizedUrl("https://cdn.shopify.com/s/files/1/x/a.png?v=12")).toBe("https://cdn.shopify.com/s/files/1/x/a.png?v=12&width=1600");
    expect(sizedUrl("//shop.com/cdn/shop/files/a.jpg")).toBe("https://shop.com/cdn/shop/files/a.jpg?width=1600");
  });

  it("rules out any image with visible skin (YouCam copies it onto the user)", () => {
    const clean = { person_visible: false, bare_arms_or_skin_visible: false, single_garment: true, front_view: true, plain_background: true };
    expect(usableForTryOn(clean)).toBe(true);
    expect(usableForTryOn({ ...clean, person_visible: true, bare_arms_or_skin_visible: true })).toBe(false);
    expect(usableForTryOn({ ...clean, person_visible: true })).toBe(true); // covered model is fine
    expect(usableForTryOn({ ...clean, front_view: false })).toBe(false);
  });
});

describe("product building", () => {
  it("uses the cheapest in-stock variant as the list price", () => {
    const p = product({
      variants: [
        { id: 1, title: "S", price: "80.00", available: false, option1: "S" },
        { id: 2, title: "M", price: "95.00", available: true, option1: "M" },
        { id: 3, title: "L", price: "99.00", available: true, option1: "L" },
      ],
    });
    expect(listPrice(p)).toBe(95);
  });

  it("reads sizes from the Size option even when colour comes first", () => {
    const shirt = byTitle("Relaxed Fit Button Up Shirt - Paisley");
    expect(variantSize(shirt, shirt.variants[0])).toBe("S");
  });

  it("builds a CLAUDE.md Product in SGD", () => {
    const store = { domain: "shop.us", name: "Shop", fills: [], currency: "USD" };
    const tag = { id: 1, menswear: true, category: "top" as const, colour: "white", formality: "casual" as const, occasions: ["date" as const] };
    const built = buildProduct(store, product(), tag, "https://img");
    expect(built).toMatchObject({
      id: "shop.us-1",
      price: 130,
      currency: "SGD",
      originalPrice: 100,
      originalCurrency: "USD",
      url: "https://shop.us/products/linen-shirt",
      variants: [{ id: 11, size: "M", available: true }],
    });
  });
});

describe("tag schemas", () => {
  const good = { id: 1, menswear: true, category: "top", colour: "navy", formality: "smart-casual", occasions: ["date"] };
  it("accepts a valid tag", () => expect(ProductTagSchema.safeParse(good).success).toBe(true));
  it("accepts a null category", () => expect(ProductTagSchema.safeParse({ ...good, category: null }).success).toBe(true));
  it.each([
    ["unknown category", { category: "hat" }],
    ["unknown formality", { formality: "black-tie" }],
    ["unknown occasion", { occasions: ["brunch"] }],
  ])("rejects %s", (_, change) => expect(ProductTagSchema.safeParse({ ...good, ...change }).success).toBe(false));
  it("validates a batch keyed by short numbers", () => {
    expect(TagBatchSchema.safeParse({ products: [{ ...good, id: undefined, n: 0 }] }).success).toBe(true);
  });
});
