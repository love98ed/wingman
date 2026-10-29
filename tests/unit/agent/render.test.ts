import { describe, expect, it, vi } from "vitest";
import { YouCamError } from "@/lib/youcam/errors";

const fail = (code: "QUOTA" | "NO_FACE") => async () => {
  throw new YouCamError(code, code);
};
const yc = { tryOnClothes: vi.fn(), tryOnHair: vi.fn(), tryOnBeard: vi.fn() };
vi.mock("@/lib/youcam", () => ({ youcam: () => yc, renderUrl: async () => "url" }));

const { renderLook } = await import("@/lib/agent/render");
const { photo, items } = {
  photo: { hash: "h", full: Buffer.from("f"), headShoulders: Buffer.from("h"), closeFace: Buffer.from("c") } as never,
  items: { top: { id: "x-1", image: "https://cdn.shopify.com/t.jpg" } } as never,
};

describe("renderLook", () => {
  it("returns the look without a try-on when the units run out, instead of failing the run", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    yc.tryOnClothes.mockImplementation(fail("QUOTA"));
    yc.tryOnHair.mockImplementation(fail("QUOTA"));
    const out = await renderLook({ photo, items, hair: "Curtain", beard: null });
    expect(out.outfit).toBeUndefined();
    expect(out.errors).toContain("QUOTA");
  });

  it("still stops the run for a photo without a usable face", async () => {
    yc.tryOnClothes.mockImplementation(fail("NO_FACE"));
    await expect(renderLook({ photo, items, hair: null, beard: null })).rejects.toMatchObject({ code: "NO_FACE" });
  });
});
