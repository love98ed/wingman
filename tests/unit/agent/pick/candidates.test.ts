import { describe, expect, it } from "vitest";
import { allowedFormalities, buildPool, distinctLooks, lookItems, lookTotal, pickErrors, poolLines, varied } from "@/lib/agent/pick/candidates";
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
  beard: null,
  why: "Works.",
  ...overrides,
});

const rules = { beard: ["Circle"] };

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

  it("caps each piece at its share of the budget so a full look can still fit", () => {
    // Tops may take 45% of the budget: S$100 fits S$250 (112.50) but not S$200 (90)
    expect(buildPool(catalog, { ...opts, maxBudget: 250 }).top.map((p) => p.id)).toContain("t1");
    expect(buildPool(catalog, { ...opts, maxBudget: 200 }).top.map((p) => p.id)).not.toContain("t1");
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
    expect(pickErrors([pick(), pick({ top: "t2", watch: "w1", beard: "Circle" })], pool, rules)).toEqual([]);
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
    expect(pickErrors([pick({ beard: "Walrus" })], pool, rules)).toHaveLength(1);
  });

  it("rejects looks over maxBudget and repeated tops", () => {
    const errors = pickErrors([pick({ watch: "w1" }), pick()], pool, { ...rules, maxBudget: 400 });
    expect(errors).toContain('Look 1 ("Rooftop easy"): total S$580.00 is over the S$400 budget.');
    expect(errors).toContain("Each look needs a different top.");
  });

  it("rejects two looks wearing the same outerwear", () => {
    const errors = pickErrors([pick({ outerwear: "o1" }), pick({ top: "t2", outerwear: "o1" })], pool, rules);
    expect(errors).toContain("Each look needs a different outerwear piece; two looks share one.");
  });

  it("totals a look from its products", () => {
    expect(lookTotal(lookItems(pick({ watch: "w1" }), pool))).toBe(580);
  });
});

describe("varied", () => {
  it("keeps at most two of the same product name and fills from the rest in order", () => {
    const shirts = ["9401/6", "9401/14", "9403/1", "9404/1"].map((code) =>
      product(code, { store: "colonyclothing.net", storeName: "Colony Clothing", name: `COLONY CLOTHING / NAPOLI LINEN SHIRT / ${code}` }),
    );
    const others = [product("polo", { name: "Knit Polo" }), product("tee", { name: "Pocket Tee" })];
    expect(varied([...shirts, ...others], 4).map((p) => p.id)).toEqual(["9401/6", "9401/14", "polo", "tee"]);
  });
});

describe("distinctLooks", () => {
  const look = (top: string, outerwear: string | null, name = top) => pick({ name, top, outerwear });

  it("drops a look showing the same piece as an earlier one, rather than padding to three", () => {
    const kept = distinctLooks([look("t1", "o1", "A"), look("t2", "o1", "B"), look("t3", null, "C")]);
    expect(kept.map((p) => p.name)).toEqual(["A", "C"]);
  });

  it("drops a repeated top too", () => {
    expect(distinctLooks([look("t1", null), look("t1", null)])).toHaveLength(1);
  });

  it("keeps looks that share nothing", () => {
    expect(distinctLooks([look("t1", "o1"), look("t2", "o2"), look("t3", null)])).toHaveLength(3);
  });
});
