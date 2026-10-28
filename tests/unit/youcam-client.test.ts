import { describe, expect, it, vi } from "vitest";
import { findResultUrl, skinUnits } from "@/lib/youcam/apis";
import { MemoryRenderCache } from "@/lib/youcam/cache";
import { YouCamClient } from "@/lib/youcam/client";
import { cropBoxes } from "@/lib/youcam/crops";
import { fromEngineError } from "@/lib/youcam/errors";
import { MemoryUsageStore, UnitGuard } from "@/lib/youcam/guard";
import { YouCamHttp } from "@/lib/youcam/http";

/** Fake YouCam server: file API, task create, one "running" poll then success. */
function fakeFetch() {
  let polls = 0;
  const calls: string[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url.replace("https://yce-api-01.makeupar.com", "")}`);
    if (url.endsWith("/s2s/v2.0/file")) {
      return json({
        status: 200,
        data: { files: [{ file_id: "f1", requests: [{ method: "PUT", url: "https://s3/put", headers: {} }] }] },
      });
    }
    if (url === "https://s3/put") return new Response(null, { status: 200 });
    if (url === "https://s3/result.jpg") return new Response(new Uint8Array([1, 2, 3]));
    if (init?.method === "POST") return json({ status: 200, data: { task_id: "t1" } });
    polls++;
    return json({
      status: 200,
      data:
        polls === 1
          ? { task_status: "running" }
          : { task_status: "success", error: null, results: { url: "https://s3/result.jpg" } },
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function client(fetchImpl: typeof fetch, store = new MemoryUsageStore()) {
  return {
    store,
    yc: new YouCamClient({
      http: new YouCamHttp("key", fetchImpl),
      guard: new UnitGuard(store, 700),
      cache: new MemoryRenderCache(),
      mock: false,
      poll: { initialDelayMs: 1, maxDelayMs: 1 },
    }),
  };
}

const clothes = {
  photo: Buffer.from("photo"),
  selfieHash: "s1",
  productId: "duxton.com-1",
  garmentUrl: "https://cdn.shopify.com/tee.jpg",
};

describe("YouCamClient", () => {
  it("uploads, creates the v3 task, polls to success and downloads the result", async () => {
    const { impl, calls } = fakeFetch();
    const { yc, store } = client(impl);
    const res = await yc.tryOnClothes(clothes);
    expect(res.source).toBe("live");
    expect([...(res.image ?? [])]).toEqual([1, 2, 3]);
    expect(calls).toContain("POST /s2s/v2.0/task/cloth-v3");
    expect(calls.filter((c) => c.startsWith("GET /s2s/v2.0/task/cloth-v3/t1"))).toHaveLength(2);
    expect(await store.total()).toBe(2);
  });

  it("serves the second identical call from cache with zero units", async () => {
    const { impl } = fakeFetch();
    const { yc, store } = client(impl);
    await yc.tryOnClothes(clothes);
    const callsAfterFirst = vi.mocked(impl).mock.calls.length;
    const again = await yc.tryOnClothes(clothes);
    expect(again.source).toBe("cache");
    expect(vi.mocked(impl).mock.calls.length).toBe(callsAfterFirst);
    expect(await store.total()).toBe(2);
  });

  it("sends the request body the docs specify", async () => {
    const { impl } = fakeFetch();
    const { yc } = client(impl);
    await yc.tryOnClothes(clothes);
    const create = vi.mocked(impl).mock.calls.find(([u, i]) => String(u).endsWith("/cloth-v3") && i?.method === "POST");
    expect(JSON.parse(String(create?.[1]?.body))).toEqual({
      src_file_id: "f1",
      garment_category: "auto",
      ref_file_url: "https://cdn.shopify.com/tee.jpg",
    });
  });
});

describe("YouCam helpers", () => {
  it("prices skin analysis by concern count (SD)", () => {
    expect(skinUnits(4)).toBe(9);
    expect(skinUnits(5)).toBe(12);
    expect(skinUnits(12)).toBe(14);
    expect(skinUnits(16)).toBe(16);
  });

  it("finds result URLs in nested results", () => {
    expect(findResultUrl({ url: "a" })).toBe("a");
    expect(findResultUrl({ output: [{ x: 1 }, { url: "b" }] })).toBe("b");
    expect(findResultUrl(null)).toBeNull();
  });

  it("maps engine errors to typed codes", () => {
    expect(fromEngineError("error_no_face").code).toBe("NO_FACE");
    expect(fromEngineError("error_no_shoulder").code).toBe("NO_FACE");
    expect(fromEngineError("error_lighting_dark").code).toBe("BAD_LIGHTING");
    expect(fromEngineError("error_inference").code).toBe("UNKNOWN");
  });

  it("keeps crop boxes inside the image with the face centred", () => {
    const { hair, face } = cropBoxes({ x: 1300, y: 500, width: 400, height: 520 }, 3000, 4000);
    for (const b of [hair, face]) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(3000);
      expect(b.y + b.height).toBeLessThanOrEqual(4000);
    }
    expect(face.x + face.width / 2).toBeCloseTo(1500, 0);
    expect(face.width).toBe(600);
  });

  it("shifts a crop at the image edge instead of overflowing", () => {
    const { hair } = cropBoxes({ x: 0, y: 0, width: 400, height: 500 }, 1000, 1500);
    expect(hair).toMatchObject({ x: 0, y: 0, width: 1000 });
  });
});
