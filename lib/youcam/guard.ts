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
