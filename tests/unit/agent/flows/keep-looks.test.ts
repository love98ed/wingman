import { describe, expect, it, vi } from "vitest";

// style.ts pulls in server modules at import time; only the pure keepLooks is under test.
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({}) }));
vi.mock("@/lib/youcam/index", () => ({ youcam: () => ({}) }));
vi.mock("@/lib/youcam", () => ({ youcam: () => ({}), renderUrl: async () => undefined }));
const { keepLooks, MIN_SCORE } = await import("@/lib/agent/flows/style");

describe("keepLooks", () => {
  it(`keeps every look scoring ${MIN_SCORE} or more, in order`, () => {
    expect(keepLooks([8.5, 6, 7.2])).toEqual([0, 1, 2]);
    expect(keepLooks([8, 4.5, 7])).toEqual([0, 2]);
  });

  it("keeps none when every look scores low, so the visitor is told instead of shown a weak look", () => {
    expect(keepLooks([3, 5.5, 4])).toEqual([]);
    expect(keepLooks([5.9])).toEqual([]);
  });
});
