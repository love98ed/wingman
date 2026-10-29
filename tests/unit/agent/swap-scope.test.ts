import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/memo", () => ({ memo: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: vi.fn() }));
vi.mock("@/lib/llm/client", () => ({ generateStructured: vi.fn() }));
const { optionScope } = await import("@/lib/agent/flows/swap");

describe("optionScope", () => {
  it("keeps a swap in the look's tier, under the budget cap", () => {
    expect(optionScope("mid", 200, Infinity, false)).toEqual({ tiers: ["mid"], ceiling: Infinity });
    expect(optionScope("mid", 200, 150, false)).toEqual({ tiers: ["mid"], ceiling: 150 });
  });

  it("looks for cheaper pieces in this tier and below, at least 10% under", () => {
    expect(optionScope("luxury", 500, Infinity, true)).toEqual({ tiers: ["budget", "mid", "luxury"], ceiling: 450 });
    expect(optionScope("mid", 200, Infinity, true)).toEqual({ tiers: ["budget", "mid"], ceiling: 180 });
    expect(optionScope("budget", 80, Infinity, true)).toEqual({ tiers: ["budget"], ceiling: 72 });
  });

  it("never goes over the budget cap", () => {
    expect(optionScope("mid", 200, 120, true).ceiling).toBe(120);
  });
});
