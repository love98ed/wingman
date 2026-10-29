import { describe, expect, it } from "vitest";
import { assignTiers, percentile, tierCounts, type TierInput } from "@/lib/catalog/pipeline/tiers";

const items = (category: TierInput["category"], prices: number[], inStock = true): TierInput[] =>
  prices.map((price, i) => ({ id: `${category}-${i}-${price}`, category, price, inStock }));

describe("percentile", () => {
  it("interpolates between sorted values", () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40], 1)).toBe(40);
  });
});

describe("assignTiers", () => {
  it("splits a category into thirds by price", () => {
    const tops = items("top", [30, 40, 50, 100, 120, 140, 250, 300, 400]);
    const { tiers, cutoffs } = assignTiers(tops);
    expect(cutoffs.get("top")?.mode).toBe("relative");
    const byPrice = (p: number) => tiers.get(tops.find((t) => t.price === p)!.id);
    expect([30, 40, 50].map(byPrice)).toEqual(["budget", "budget", "budget"]);
    expect([100, 120, 140].map(byPrice)).toEqual(["mid", "mid", "mid"]);
    expect([250, 300, 400].map(byPrice)).toEqual(["luxury", "luxury", "luxury"]);
  });

  it("keeps equal prices in the same tier", () => {
    // Six items at the same price plus a few others: all ties share a tier.
    const tops = items("top", [136.25, 136.25, 136.25, 136.25, 136.25, 136.25, 60, 300]);
    const { tiers } = assignTiers(tops);
    const tied = tops.filter((t) => t.price === 136.25).map((t) => tiers.get(t.id));
    expect(new Set(tied).size).toBe(1);
  });

  it("computes cutoffs per category independently", () => {
    const all = [...items("top", [20, 30, 40, 50, 60, 70]), ...items("watch", [200, 400, 600, 800, 1000, 1200])];
    const { tiers } = assignTiers(all);
    expect(tiers.get("top-5-70")).toBe("luxury");
    expect(tiers.get("watch-0-200")).toBe("budget");
  });

  it("falls back to fixed SGD thresholds under 6 in-stock items", () => {
    const shoes = items("shoes", [120, 150, 350, 351, 500]);
    const { tiers, cutoffs } = assignTiers(shoes);
    expect(cutoffs.get("shoes")?.mode).toBe("fallback");
    expect(tiers.get("shoes-0-120")).toBe("budget"); // < 150
    expect(tiers.get("shoes-1-150")).toBe("mid"); // 150 to 350 inclusive
    expect(tiers.get("shoes-2-350")).toBe("mid");
    expect(tiers.get("shoes-3-351")).toBe("luxury"); // > 350
  });

  it("ignores out-of-stock items when computing cutoffs but still tiers them", () => {
    const watches = [...items("watch", [100, 200, 300, 400, 500]), ...items("watch", [5000], false)];
    const { tiers, cutoffs } = assignTiers(watches);
    expect(cutoffs.get("watch")?.mode).toBe("fallback"); // only 5 in stock
    expect(tiers.get("watch-0-5000")).toBe("luxury");
  });

  it("counts only in-stock items per category and tier", () => {
    const all = [...items("top", [10, 20, 30, 40, 50, 60]), ...items("top", [999], false)];
    const { tiers } = assignTiers(all);
    expect(tierCounts(all, tiers).top).toEqual({ budget: 2, mid: 2, luxury: 2 });
  });
});
