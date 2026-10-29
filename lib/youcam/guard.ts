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
    /** Dev logging. Running totals cost a query, so they're only fetched when this is set. */
    private readonly log?: (msg: string) => void,
  ) {}

  async run<T>(api: string, units: number, cacheKey: string, call: () => Promise<T>): Promise<T> {
    const id = await this.store.reserve(api, units, this.limit, cacheKey);
    let result: T;
    try {
      result = await call();
    } catch (err) {
      const timedOut = err instanceof YouCamError && err.code === "TIMEOUT";
      // A failed release leaves the units reserved: an overcount, never an overspend.
      if (!timedOut) await this.store.settle(id, "failed").catch(() => undefined);
      this.log?.(`[youcam] ${api} failed${timedOut ? " (units kept reserved)" : ""}: ${(err as Error).message}`);
      throw err;
    }
    // The call succeeded and is paid for: bookkeeping problems must not throw it away.
    // If the settle fails the units stay counted as reserved, which is still correct.
    await this.store.settle(id, "ok").catch((err: Error) => console.warn(`[youcam] ${api} settle failed: ${err.message}`));
    if (this.log) {
      const total = await this.store.total().catch(() => NaN);
      this.log(`[youcam] ${api} +${units} units (total ${total}/${this.limit})`);
    }
    return result;
  }

  total() {
    return this.store.total();
  }

  totalsByApi() {
    return this.store.totalsByApi();
  }
}
