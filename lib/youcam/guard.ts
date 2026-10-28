import { YouCamError } from "./errors";

export interface UsageStore {
  /** Atomically record a reservation, or throw YouCamError QUOTA if it would pass the limit. */
  reserve(api: string, units: number, limit: number, cacheKey: string): Promise<number>;
  settle(id: number, status: "ok" | "failed"): Promise<void>;
  /** Units used or reserved so far (failed calls excluded). */
  total(): Promise<number>;
  totalsByApi(): Promise<Record<string, number>>;
}

/**
 * Hard stop on YouCam spend. Every live call reserves its units first; YouCam only
 * charges for successful tasks, so engine errors are released. Timeouts stay
 * reserved because the task may still finish and be charged.
 */
export class UnitGuard {
  constructor(
    private readonly store: UsageStore,
    private readonly limit: number,
    private readonly log: (msg: string) => void = () => {},
  ) {}

  async run<T>(api: string, units: number, cacheKey: string, call: () => Promise<T>): Promise<T> {
    const id = await this.store.reserve(api, units, this.limit, cacheKey);
    try {
      const result = await call();
      await this.store.settle(id, "ok");
      this.log(`[youcam] ${api} +${units} units (total ${await this.store.total()}/${this.limit})`);
      return result;
    } catch (err) {
      const timedOut = err instanceof YouCamError && err.code === "TIMEOUT";
      if (!timedOut) await this.store.settle(id, "failed");
      this.log(
        `[youcam] ${api} failed${timedOut ? " (units kept reserved)" : ""}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  total() {
    return this.store.total();
  }

  totalsByApi() {
    return this.store.totalsByApi();
  }
}

/** In-memory store with the same semantics as the Supabase function, for tests and mock mode. */
export class MemoryUsageStore implements UsageStore {
  rows: { id: number; api: string; units: number; status: "reserved" | "ok" | "failed" }[] = [];

  async reserve(api: string, units: number, limit: number): Promise<number> {
    const used = await this.total();
    if (used + units > limit) {
      throw new YouCamError("QUOTA", `YouCam unit limit reached (${used} + ${units} > ${limit})`);
    }
    const id = this.rows.length + 1;
    this.rows.push({ id, api, units, status: "reserved" });
    return id;
  }

  async settle(id: number, status: "ok" | "failed") {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.status = status;
  }

  async total() {
    return this.rows.filter((r) => r.status !== "failed").reduce((s, r) => s + r.units, 0);
  }

  async totalsByApi() {
    const out: Record<string, number> = {};
    for (const r of this.rows) if (r.status !== "failed") out[r.api] = (out[r.api] ?? 0) + r.units;
    return out;
  }
}
