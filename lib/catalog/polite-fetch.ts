export const USER_AGENT = "WingmanBot/0.1 (+https://wingman-eight-beta.vercel.app)";

/** Shopify answered 429 every time, even after waiting. Says nothing about the store itself. */
export class RateLimitedError extends Error {
  constructor(url: string) {
    super(`Rate limited (HTTP 429) on ${url}`);
    this.name = "RateLimitedError";
  }
}

/** Network error or timeout after all retries. */
export class FetchFailedError extends Error {
  constructor(url: string, cause: unknown) {
    super(`Request failed after retries: ${url} (${(cause as Error)?.message ?? cause})`);
    this.name = "FetchFailedError";
  }
}

type Options = {
  /** Minimum gap between any two requests. Shopify rate-limits per client IP across stores. */
  minIntervalMs?: number;
  timeoutMs?: number;
  /** CLAUDE.md 5b: timeout after 2 retries. */
  retries?: number;
  /** How many times to wait out a 429 before giving up. */
  rateLimitWaits?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
};

/** Serial, slow fetch for Shopify storefronts: one request at a time, honours Retry-After. */
export class PoliteFetcher {
  private last = 0;
  private readonly o: Required<Options>;

  constructor(options: Options = {}) {
    this.o = {
      minIntervalMs: 2500,
      timeoutMs: 15_000,
      retries: 2,
      rateLimitWaits: 2,
      fetchImpl: fetch,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      log: () => {},
      ...options,
    };
  }

  async get(url: string, init: RequestInit = {}): Promise<Response> {
    let failures = 0;
    let waits = 0;
    for (;;) {
      const gap = this.last + this.o.minIntervalMs - Date.now();
      if (gap > 0) await this.o.sleep(gap);
      this.last = Date.now();

      let res: Response;
      try {
        res = await this.o.fetchImpl(url, {
          ...init,
          headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/html", ...init.headers },
          signal: AbortSignal.timeout(this.o.timeoutMs),
        });
      } catch (err) {
        if (failures++ >= this.o.retries) throw new FetchFailedError(url, err);
        await this.o.sleep(2000 * failures);
        continue;
      }

      if (res.status === 429) {
        if (waits++ >= this.o.rateLimitWaits) throw new RateLimitedError(url);
        const seconds = Number(res.headers.get("retry-after")) || 60;
        this.o.log(`  429 on ${new URL(url).host}, waiting ${seconds}s`);
        await this.o.sleep(seconds * 1000);
        continue;
      }
      return res;
    }
  }
}
