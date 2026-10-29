import { describe, expect, it } from "vitest";
import { browse, colourFamily, compareSizes, normaliseSize } from "@/lib/catalog/browse";
import type { Product } from "@/lib/catalog/types";

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    store: "duxton.com",
    storeName: "DUXTON",
    name: `Item ${id}`,
    price: 100,
    currency: "SGD",
    tier: "mid",
    category: "top",
    originalPrice: 100,
    originalCurrency: "SGD",
    colour: "navy",
    formality: "smart-casual",
    occasions: [],
    image: "",
    images: [],
    url: "",
    variants: [{ id: 1, size: "M", available: true }],
    updatedAt: "2026-10-28T00:00:00Z",
    ...overrides,
  };
}

describe("colourFamily", () => {
  it("groups shades into families", () => {
    expect(colourFamily("Midnight Blue")).toBe("Navy");
    expect(colourFamily("walnut brown")).toBe("Brown");
    expect(colourFamily("olive green")).toBe("Green");
    expect(colourFamily("khaki beige")).toBe("Beige");
    expect(colourFamily("off-white")).toBe("White");
    expect(colourFamily("oxblood")).toBe("Red");
    expect(colourFamily("rose gold")).toBe("Metal");
  });

  it("calls stripes, prints and two-colour names a pattern", () => {
    expect(colourFamily("navy with white stripes")).toBe("Pattern");
    expect(colourFamily("cream with dark green palm leaf print")).toBe("Pattern");
    expect(colourFamily("olive green and brown camouflage")).toBe("Pattern");
  });

  it("falls back to Other", () => {
    expect(colourFamily("unknown")).toBe("Other");
  });
});

describe("normaliseSize", () => {
  it("folds the ways stores write the same size", () => {
    expect(["M/46", "MEDIUM", "m", "M / 46", "48/L"].map(normaliseSize)).toEqual(["M", "M", "M", "M", "L"]);
    expect(["2XL", "XXL/52"].map(normaliseSize)).toEqual(["XXL", "XXL"]);
    expect(["EU 42", "EU 40.5", "W32 L30"].map(normaliseSize)).toEqual(["42", "40.5", "32"]);
    expect(["Default Title", "FREE"].map(normaliseSize)).toEqual(["One size", "One size"]);
  });

  it("drops made-to-measure options", () => {
    expect(normaliseSize("MADE TO MEASURE (+70 SGD)")).toBeNull();
  });

  it("sorts letters in wearing order before numbers", () => {
    expect(["L", "32", "S", "XL", "30", "XS", "7.5D"].sort(compareSizes)).toEqual(["XS", "S", "L", "XL", "7.5D", "30", "32"]);
  });
});

describe("browse", () => {
  const catalog = [
    product("navy-m", { price: 80 }),
    product("white-l", { colour: "white", price: 300, variants: [{ id: 2, size: "LARGE", available: true }] }),
    product("navy-lux", { tier: "luxury", price: 600, store: "kevinseah.com", storeName: "Kevin Seah" }),
    product("navy-soldout-s", { variants: [{ id: 3, size: "S", available: false }, { id: 4, size: "M", available: true }] }),
    product("shoe", { category: "shoes", variants: [{ id: 5, size: "EU 42", available: true }] }),
  ];

  it("filters by category and sorts by price", () => {
    expect(browse(catalog, { category: "top" }).items.map((p) => p.id)).toEqual(["navy-m", "navy-soldout-s", "white-l", "navy-lux"]);
    expect(browse(catalog, { category: "top", sort: "price-desc" }).items[0].id).toBe("navy-lux");
  });

  it("applies tier, price band, colour, size and store together", () => {
    expect(browse(catalog, { category: "top", tier: "mid", price: "250-500" }).items.map((p) => p.id)).toEqual(["white-l"]);
    expect(browse(catalog, { category: "top", colour: "Navy", store: "kevinseah.com" }).items.map((p) => p.id)).toEqual(["navy-lux"]);
    expect(browse(catalog, { category: "top", size: "L" }).items.map((p) => p.id)).toEqual(["white-l"]);
  });

  it("matches in-stock sizes only", () => {
    expect(browse(catalog, { category: "top", size: "S" }).items).toEqual([]);
  });

  it("counts each facet against the other filters, so a chosen colour keeps the others visible", () => {
    const { facets } = browse(catalog, { category: "top", colour: "White" });
    expect(facets.colours).toEqual([
      { value: "Navy", count: 3 },
      { value: "White", count: 1 },
    ]);
    expect(facets.stores).toEqual([{ value: "duxton.com", label: "DUXTON", count: 1 }]);
    expect(facets.sizes).toEqual([{ value: "L", count: 1 }]);
  });
});
