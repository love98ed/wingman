import { describe, expect, it, vi } from "vitest";
import { YouCamClient } from "@/lib/youcam/client";
import { YouCamError } from "@/lib/youcam/errors";
import { UnitGuard, type UsageStore } from "@/lib/youcam/guard";
import { YouCamHttp } from "@/lib/youcam/http";
import { MemoryRenderCache, MemoryUsageStore } from "../../fakes/youcam";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A poll endpoint that answers with each of `replies` in turn: a Response, or an Error to throw. */
function pollFetch(replies: (Response | Error)[]) {
  let i = 0;
  return vi.fn(async () => {
    const reply = replies[Math.min(i++, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    return reply;
  }) as unknown as typeof fetch;
}

const running = () => json({ status: 200, data: { task_status: "running" } });
const success = () => json({ status: 200, data: { task_status: "success", results: { url: "https://s3/r.jpg" } } });
const fast = { initialDelayMs: 1, maxDelayMs: 1, timeoutMs: 5_000 };

describe("YouCamHttp.pollTask", () => {
  it("keeps polling through a dropped connection and a server error", async () => {
    const http = new YouCamHttp("key", pollFetch([new TypeError("fetch failed"), json({}, 502), running(), success()]));
    const res = await http.pollTask("/task/x", "t1", fast);
    expect(res.data.task_status).toBe("success");
  });

  it("gives up as TIMEOUT after three failed checks in a row, so the guard keeps the units reserved", async () => {
    const http = new YouCamHttp("key", pollFetch([new TypeError("fetch failed")]));
    const err = await http.pollTask("/task/x", "t1", fast).catch((e) => e);
    expect(err).toBeInstanceOf(YouCamError);
    expect(err.code).toBe("TIMEOUT");
  });

  it("resets the miss count after a good check", async () => {
    const down = new TypeError("fetch failed");
    const http = new YouCamHttp("key", pollFetch([down, down, running(), down, down, success()]));
    await expect(http.pollTask("/task/x", "t1", fast)).resolves.toMatchObject({ data: { task_status: "success" } });
  });

  it("stops at once when the account is out of units", async () => {
    const http = new YouCamHttp("key", pollFetch([json({ error_code: "CreditInsufficiency" }, 400)]));
    const err = await http.pollTask("/task/x", "t1", fast).catch((e) => e);
    expect(err.code).toBe("QUOTA");
  });

  it("maps a failed task to its error code", async () => {
    const http = new YouCamHttp("key", pollFetch([json({ status: 200, data: { task_status: "error", error: "error_no_face" } })]));
    const err = await http.pollTask("/task/x", "t1", fast).catch((e) => e);
    expect(err.code).toBe("NO_FACE");
  });

  it("times out when the task never finishes", async () => {
    const http = new YouCamHttp("key", pollFetch([running()]));
    const err = await http.pollTask("/task/x", "t1", { initialDelayMs: 1, maxDelayMs: 1, timeoutMs: 20 }).catch((e) => e);
    expect(err.code).toBe("TIMEOUT");
  });
});

describe("UnitGuard bookkeeping", () => {
  it("returns a paid result even when marking it ok fails, and keeps its units counted", async () => {
    const store = new MemoryUsageStore();
    store.settle = async () => {
      throw new Error("database down");
    };
    const guard = new UnitGuard(store, 10);
    await expect(guard.run("clothes", 2, "k", async () => "render")).resolves.toBe("render");
    expect(await store.total()).toBe(2);
  });

  it("rethrows the YouCam error even when releasing the units fails", async () => {
    const store = new MemoryUsageStore();
    store.settle = async () => {
      throw new Error("database down");
    };
    const guard = new UnitGuard(store, 10);
    const err = await guard
      .run("clothes", 2, "k", async () => {
        throw new YouCamError("NO_FACE", "no face");
      })
      .catch((e) => e);
    expect(err.code).toBe("NO_FACE");
  });

  it("only reads the running total when logging, and a failed read can't fail the call", async () => {
    const total = vi.fn(async (): Promise<number> => {
      throw new Error("database down");
    });
    const store: UsageStore = { reserve: async () => 1, settle: async () => {}, total, totalsByApi: async () => ({}) };
    await new UnitGuard(store, 10).run("clothes", 2, "k1", async () => "a");
    expect(total).not.toHaveBeenCalled();

    const lines: string[] = [];
    await expect(new UnitGuard(store, 10, (l) => lines.push(l)).run("clothes", 2, "k2", async () => "b")).resolves.toBe("b");
    expect(total).toHaveBeenCalledTimes(1);
    expect(lines[0]).toContain("+2 units");
  });
});

describe("YouCamClient", () => {
  it("still returns a paid render when the cache can't store it", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/s2s/v2.0/file")) {
        return json({ data: { files: [{ file_id: "f1", requests: [{ method: "PUT", url: "https://s3/put", headers: {} }] }] } });
      }
      if (url === "https://s3/put") return new Response(null, { status: 200 });
      if (url === "https://s3/r.jpg") return new Response(new Uint8Array([7, 8, 9]));
      if (init?.method === "POST") return json({ data: { task_id: "t1" } });
      return success();
    }) as unknown as typeof fetch;
    const cache = new MemoryRenderCache();
    cache.put = async () => {
      throw new Error("storage down");
    };
    const store = new MemoryUsageStore();
    const yc = new YouCamClient({
      http: new YouCamHttp("key", fetchImpl),
      guard: new UnitGuard(store, 700),
      cache,
      mock: false,
      poll: { initialDelayMs: 1, maxDelayMs: 1 },
    });
    const res = await yc.tryOnClothes({ photo: Buffer.from("p"), selfieHash: "s", productId: "x-1", garmentUrl: "https://g.jpg" });
    expect(res.source).toBe("live");
    expect([...(res.image ?? [])]).toEqual([7, 8, 9]);
    expect(res.imagePath).toBeUndefined();
    expect(await store.total()).toBe(2);
  });
});
