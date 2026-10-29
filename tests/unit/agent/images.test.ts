import { describe, expect, it } from "vitest";
import type { Look } from "@/lib/agent/events";
import { expectedKinds, imageStatus } from "@/lib/agent/images";

const item = (slot: Look["items"][number]["slot"]) =>
  ({ slot, id: slot, name: slot, store: "s", storeName: "S", price: 1, colour: "", image: "", url: "", sizes: [] }) as Look["items"][number];

const look = (over: Partial<Look> = {}): Look => ({
  name: "Look",
  tier: "mid",
  why: "",
  items: [item("top"), item("bottom")],
  hair: "Curtain",
  beard: null,
  renders: { errors: [] },
  fitCheck: null,
  total: 2,
  ...over,
});

describe("expectedKinds", () => {
  it("waits for the outfit, then hair and beard only when picked", () => {
    expect(expectedKinds(look())).toEqual(["outfit", "hair"]);
    expect(expectedKinds(look({ hair: null, beard: "Goatee" }))).toEqual(["outfit", "beard"]);
    expect(expectedKinds(look({ items: [item("shoes")], hair: null }))).toEqual([]);
  });
});

describe("imageStatus", () => {
  it("counts ready and failed images across looks", () => {
    const status = imageStatus([
      look({ renders: { outfit: "a", hair: "b", errors: [] } }),
      look({ renders: { outfit: "c", errors: [], failed: { hair: "TIMEOUT" } } }),
      look({ beard: "Goatee" }),
    ]);
    expect(status).toEqual({
      total: 7,
      ready: 3,
      failed: [{ look: 1, kind: "hair", code: "TIMEOUT" }],
      outOfUnits: false,
    });
  });

  it("flags a run where every failure is the unit cap", () => {
    expect(imageStatus([look({ renders: { errors: [], failed: { outfit: "QUOTA", hair: "QUOTA" } } })]).outOfUnits).toBe(true);
    expect(imageStatus([look({ renders: { outfit: "a", hair: "b", errors: [] } })]).outOfUnits).toBe(false);
  });

  it("ignores a failure once that image has landed", () => {
    expect(imageStatus([look({ renders: { outfit: "a", hair: "b", errors: [], failed: { hair: "TIMEOUT" } } })]).failed).toEqual([]);
  });
});
