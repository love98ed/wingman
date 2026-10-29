import { describe, expect, it } from "vitest";
import { cartPermalink, groupByStore, isOneSize, pieceCount, sizeChoices, type CartLine } from "@/lib/cart";

describe("cartPermalink", () => {
  it("builds https://{store}/cart/{variantId}:{qty},... in order", () => {
    expect(cartPermalink("duxton.com", [{ variantId: 111, qty: 1 }, { variantId: 222, qty: 2 }])).toBe(
      "https://duxton.com/cart/111:1,222:2",
    );
  });

  it("merges the same variant into one quantity", () => {
    expect(cartPermalink("duxton.com", [{ variantId: 111, qty: 1 }, { variantId: 111, qty: 1 }])).toBe(
      "https://duxton.com/cart/111:2",
    );
  });

  it("keeps Shopify's 14-digit variant ids exact", () => {
    expect(cartPermalink("colonyclothing.net", [{ variantId: 51436284805430, qty: 1 }])).toBe(
      "https://colonyclothing.net/cart/51436284805430:1",
    );
  });

  it("refuses anything that isn't a plain store domain", () => {
    for (const store of ["", "evil.com/path", "https://duxton.com", "duxton", "a b.com", "duxton.com?x=1"]) {
      expect(() => cartPermalink(store, [{ variantId: 1, qty: 1 }])).toThrow(/store domain/);
    }
  });

  it("refuses bad variant ids, bad quantities and an empty cart", () => {
    expect(() => cartPermalink("duxton.com", [{ variantId: 0, qty: 1 }])).toThrow(/variant/);
    expect(() => cartPermalink("duxton.com", [{ variantId: 1.5, qty: 1 }])).toThrow(/variant/);
    expect(() => cartPermalink("duxton.com", [{ variantId: 1, qty: 0 }])).toThrow(/quantity/);
    expect(() => cartPermalink("duxton.com", [{ variantId: 1, qty: 1.5 }])).toThrow(/quantity/);
    expect(() => cartPermalink("duxton.com", [])).toThrow(/at least one/);
  });
});

describe("sizeChoices", () => {
  it("offers in-stock variants only", () => {
    const choices = sizeChoices([
      { id: 1, size: "S", available: false },
      { id: 2, size: "M", available: true },
      { id: 3, size: "L", available: true },
    ]);
    expect(choices).toEqual([
      { variantId: 2, size: "M" },
      { variantId: 3, size: "L" },
    ]);
  });

  it("shows the full title when a size repeats across colours", () => {
    const choices = sizeChoices([
      { id: 1, size: "M", title: "Navy / M", available: true },
      { id: 2, size: "M", title: "White / M", available: true },
      { id: 3, size: "L", title: "Navy / L", available: true },
    ]);
    expect(choices.map((c) => c.size)).toEqual(["Navy / M", "White / M", "L"]);
  });

  it("calls a product with no options one size", () => {
    const choices = sizeChoices([{ id: 9, size: "Default Title", title: "Default Title", available: true }]);
    expect(choices).toEqual([{ variantId: 9, size: "One size" }]);
    expect(isOneSize(choices)).toBe(true);
    expect(isOneSize([{ variantId: 1, size: "M" }])).toBe(false);
  });
});

describe("groupByStore", () => {
  const line = (id: string, store: string, price: number, variantId: number | null, qty = 1): CartLine => ({
    id,
    store,
    storeName: store.toUpperCase(),
    name: id,
    price,
    image: "",
    url: "",
    sizes: [{ variantId: variantId ?? 9, size: "M" }],
    variantId,
    qty,
  });

  it("groups by store in first-seen order with subtotals", () => {
    const groups = groupByStore([line("a", "x.com", 10.5, 1), line("b", "y.com", 20, 2), line("c", "x.com", 5, 3, 2)]);
    expect(groups.map((g) => [g.store, g.lines.map((l) => l.id), g.subtotal])).toEqual([
      ["x.com", ["a", "c"], 20.5],
      ["y.com", ["b"], 20],
    ]);
    expect(groups[0].checkoutUrl).toBe("https://x.com/cart/1:1,3:2");
  });

  it("has no checkout link until every line in that store has a size", () => {
    const groups = groupByStore([line("a", "x.com", 10, null), line("b", "y.com", 20, 2)]);
    expect(groups[0].checkoutUrl).toBeNull();
    expect(groups[1].checkoutUrl).toBe("https://y.com/cart/2:1");
    expect(groups[0].missingSizes).toBe(1);
  });

  it("leaves a sold-out piece out of the subtotal and checkout instead of blocking it", () => {
    const soldOut = { ...line("s", "x.com", 99, null), sizes: [] };
    const [group] = groupByStore([line("a", "x.com", 10, 1, 2), soldOut]);
    expect(group.subtotal).toBe(20);
    expect(group.missingSizes).toBe(0);
    expect(group.checkoutUrl).toBe("https://x.com/cart/1:2");
    expect(groupByStore([soldOut])[0].checkoutUrl).toBeNull();
  });

  it("counts pieces with their quantities", () => {
    expect(pieceCount([line("a", "x.com", 1, 1, 2), line("b", "x.com", 1, 2)])).toBe(3);
  });
});
