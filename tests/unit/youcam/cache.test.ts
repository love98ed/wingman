import { describe, expect, it } from "vitest";
import { renderCacheKey, stableStringify } from "@/lib/youcam/cache";

const base = {
  selfieHash: "abc",
  productId: "duxton.com-1",
  api: "clothes",
  params: { garment_category: "auto", ref_file_url: "https://cdn/x.jpg" },
};

describe("renderCacheKey", () => {
  it("is a stable sha256 hex string", () => {
    expect(renderCacheKey(base)).toMatch(/^[0-9a-f]{64}$/);
    expect(renderCacheKey(base)).toBe(renderCacheKey({ ...base }));
  });

  it("ignores param key order", () => {
    const reordered = { ...base, params: { ref_file_url: "https://cdn/x.jpg", garment_category: "auto" } };
    expect(renderCacheKey(reordered)).toBe(renderCacheKey(base));
  });

  it.each([
    ["selfie", { selfieHash: "def" }],
    ["product", { productId: "duxton.com-2" }],
    ["api", { api: "hair" }],
    ["params", { params: { garment_category: "upper_body", ref_file_url: "https://cdn/x.jpg" } }],
  ])("changes when the %s changes", (_, change) => {
    expect(renderCacheKey({ ...base, ...change })).not.toBe(renderCacheKey(base));
  });

  it("treats missing and null product id the same", () => {
    const withoutProduct = { ...base, productId: undefined };
    expect(renderCacheKey(withoutProduct)).toBe(renderCacheKey({ ...base, productId: null }));
  });
});

describe("stableStringify", () => {
  it("sorts nested keys and drops undefined", () => {
    expect(stableStringify({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })).toBe(
      '{"a":{"d":[2,{"y":2,"z":1}]},"b":1}',
    );
  });
});
