import { describe, expect, it } from "vitest";
import { allowedFormalities, buildPool, lookItems, lookTotal, pickErrors, poolLines } from "@/lib/agent/catalog";
import type { LookPick } from "@/lib/agent/schemas";
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
    occasions: ["date"],
    image: "https://cdn.shopify.com/x.jpg",
    images: [],
    url: "https://duxton.com/products/x",
    variants: [{ id: 1, size: "M", available: true }],
    updatedAt: "2026-10-28T00:00:00Z",
    ...overrides,
  };
}

const catalog: Product[] = [
  product("t1"),
  product("t2", { occasions: [] }),
  product("t3", { formality: "formal" }),
  product("t-oos", { variants: [{ id: 2, size: "M", available: false }] }),
  product("t-pricey", { price: 900 }),
  product("b1", { category: "bottom", price: 80 }),
  product("s1", { category: "shoes", price: 150 }),
  product("w1", { category: "watch", price: 250 }),
];

const opts = { occasion: "date" as const, formality: "smart-casual" as const, seed: "photo" };

const pick = (overrides: Partial<LookPick> = {}): LookPick => ({
  name: "Rooftop easy",
  top: "t1",
  outerwear: null,
  bottom: "b1",
  shoes: "s1",
  watch: null,
  hair: null,
  beard: null,
  why: "Works.",
  ...overrides,
});

const rules = { hair: ["Modern Slick Back"], beard: ["Circle"] };

describe("allowedFormalities", () => {
  it("lets smart-casual borrow from both sides, the ends from their neighbour only", () => {
    expect(allowedFormalities("smart-casual")).toEqual(["smart-casual", "casual", "formal"]);
    expect(allowedFormalities("casual")).toEqual(["casual", "smart-casual"]);
    expect(allowedFormalities("formal")).toEqual(["formal", "smart-casual"]);
  });
});

describe("buildPool", () => {
  it("keeps only in-stock items and ranks occasion match, then exact formality", () => {
    const pool = buildPool(catalog, opts);
    expect(pool.top.map((p) => p.id)).toEqual(["t1", "t-pricey", "t3", "t2"]);
    expect(pool.top.some((p) => p.id === "t-oos")).toBe(false);
  });

  it("drops items that alone exceed maxBudget", () => {
    expect(buildPool(catalog, { ...opts, maxBudget: 500 }).top.some((p) => p.id === "t-pricey")).toBe(false);
  });

  it("drops formality levels too far from the occasion", () => {
    const formal = product("t-formal", { formality: "formal" });
    expect(buildPool([formal], { ...opts, formality: "casual" }).top).toEqual([]);
  });

  it("is deterministic for the same seed", () => {
    const many = Array.from({ length: 40 }, (_, i) => product(`x${i}`));
    const a = buildPool(many, opts).top.map((p) => p.id);
    expect(buildPool([...many].reverse(), opts).top.map((p) => p.id)).toEqual(a);
    expect(a).toHaveLength(30);
  });

  it("lists every slot in the prompt, marking empty ones", () => {
    const text = poolLines(buildPool(catalog, opts));
    expect(text).toContain("## top\nt1 | Item t1 | navy | smart-casual | S$100 | DUXTON");
    expect(text).toContain("## outerwear\n(none)");
  });
});

describe("pickErrors", () => {
  const pool = buildPool(catalog, opts);

  it("accepts a valid pick", () => {
    expect(pickErrors([pick(), pick({ top: "t2", watch: "w1", hair: "Modern Slick Back" })], pool, rules)).toEqual([]);
  });

  it("rejects ids that are not candidates, or in the wrong slot", () => {
    const errors = pickErrors([pick({ top: "t-oos", shoes: "b1" })], pool, rules);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/"t-oos" is not in the top list/);
    expect(errors[1]).toMatch(/"b1" is not in the shoes list/);
  });

  it("requires top, bottom and shoes", () => {
    expect(pickErrors([pick({ bottom: "" })], pool, rules)).toEqual(['Look 1 ("Rooftop easy"): bottom is required.']);
  });

  it("rejects grooming styles outside the allowed list", () => {
    expect(pickErrors([pick({ hair: "Rainbow Bob", beard: "Walrus" })], pool, rules)).toHaveLength(2);
  });

  it("rejects looks over maxBudget and repeated tops", () => {
    const errors = pickErrors([pick({ watch: "w1" }), pick()], pool, { ...rules, maxBudget: 400 });
    expect(errors).toContain('Look 1 ("Rooftop easy"): total S$580.00 is over the S$400 budget.');
    expect(errors).toContain("Each look needs a different top.");
  });

  it("totals a look from its products", () => {
    expect(lookTotal(lookItems(pick({ watch: "w1" }), pool))).toBe(580);
  });
});
