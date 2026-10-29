import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const deletePhotoData = vi.fn(async () => {});
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: () => ({}) }));
vi.mock("@/lib/privacy", () => ({ deletePhotoData }));

const { POST } = await import("@/app/api/photo/delete/route");
const { normalisePhoto, preparePhoto } = await import("@/lib/photo/prepare");

const demo = readFileSync("fixtures/selfies/demo.jpg");
const upload = (bytes: Buffer, type = "image/jpeg") => {
  const form = new FormData();
  form.set("photo", new File([new Uint8Array(bytes)], "photo.jpg", { type }));
  return new Request("http://x/api/photo/delete", { method: "POST", body: form });
};

describe("Delete my photo", () => {
  it("deletes by the same hash that styling stores renders under", async () => {
    // Styling keys every render by preparePhoto's hash; the delete route must arrive at the same one.
    const styled = await preparePhoto(demo, async (_jpeg, width, height) => ({
      x: width * 0.4,
      y: height * 0.1,
      width: width * 0.2,
      height: height * 0.2,
      roll: 0,
    }));
    const res = await POST(upload(demo));
    expect(res.status).toBe(200);
    expect(deletePhotoData).toHaveBeenCalledWith(expect.anything(), styled.hash);
    expect((await normalisePhoto(demo)).hash).toBe(styled.hash);
  });

  it("refuses a request without a photo", async () => {
    deletePhotoData.mockClear();
    const res = await POST(new Request("http://x/api/photo/delete", { method: "POST", body: new FormData() }));
    expect(res.status).toBe(400);
    expect(deletePhotoData).not.toHaveBeenCalled();
  });

  it("reports a failure instead of claiming the photo is gone", async () => {
    deletePhotoData.mockRejectedValueOnce(new Error("storage down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(upload(demo));
    expect(res.status).toBe(500);
    expect((await res.json()).deleted).toBeUndefined();
  });
});
