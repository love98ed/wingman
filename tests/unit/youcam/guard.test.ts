import { describe, expect, it } from "vitest";
import { MemoryUsageStore, UnitGuard } from "@/lib/youcam/guard";
import { YouCamError } from "@/lib/youcam/errors";

const ok = async () => "done";
const fail = (code: "TIMEOUT" | "NO_FACE") => async () => {
  throw new YouCamError(code, code);
};

describe("UnitGuard", () => {
  it("logs units for a successful call", async () => {
    const store = new MemoryUsageStore();
    const guard = new UnitGuard(store, 10);
    await expect(guard.run("clothes", 2, "k1", ok)).resolves.toBe("done");
    expect(await guard.total()).toBe(2);
    expect(store.rows[0]).toMatchObject({ api: "clothes", units: 2, status: "ok" });
  });

  it("refuses a call that would pass the limit, without calling YouCam", async () => {
    const guard = new UnitGuard(new MemoryUsageStore(), 10);
    await guard.run("skin", 9, "k1", ok);
    let called = false;
    const err = await guard
      .run("clothes", 2, "k2", async () => {
        called = true;
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(YouCamError);
    expect(err.code).toBe("QUOTA");
    expect(called).toBe(false);
    expect(await guard.total()).toBe(9);
  });

  it("allows a call that lands exactly on the limit", async () => {
    const guard = new UnitGuard(new MemoryUsageStore(), 10);
    await guard.run("skin", 9, "k1", ok);
    await expect(guard.run("hair", 1, "k2", ok)).resolves.toBe("done");
    expect(await guard.total()).toBe(10);
  });

  it("releases units when YouCam reports an engine error (not charged)", async () => {
    const guard = new UnitGuard(new MemoryUsageStore(), 10);
    await expect(guard.run("hair", 1, "k1", fail("NO_FACE"))).rejects.toMatchObject({ code: "NO_FACE" });
    expect(await guard.total()).toBe(0);
  });

  it("keeps units reserved on timeout (task may still be charged)", async () => {
    const guard = new UnitGuard(new MemoryUsageStore(), 10);
    await expect(guard.run("clothes", 2, "k1", fail("TIMEOUT"))).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(await guard.total()).toBe(2);
  });

  it("reports totals by API", async () => {
    const guard = new UnitGuard(new MemoryUsageStore(), 100);
    await guard.run("clothes", 2, "a", ok);
    await guard.run("clothes", 2, "b", ok);
    await guard.run("skin", 9, "c", ok);
    expect(await guard.totalsByApi()).toEqual({ clothes: 4, skin: 9 });
  });

  it("logs a running total", async () => {
    const lines: string[] = [];
    const guard = new UnitGuard(new MemoryUsageStore(), 700, (l) => lines.push(l));
    await guard.run("beard", 2, "k", ok);
    expect(lines[0]).toContain("total 2/700");
  });
});
