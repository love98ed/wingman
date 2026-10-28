import { describe, expect, it } from "vitest";
import { FetchFailedError, PoliteFetcher, RateLimitedError } from "@/lib/catalog/polite-fetch";
import { currencyFrom, permalinkResolves, ProductsFeedSchema, shopifyFingerprint } from "@/lib/catalog/verify";

describe("ProductsFeedSchema", () => {
  const product = { id: 1, handle: "tee", variants: [{ id: 11, price: "39.00", available: true }], images: [] };

  it("accepts the Shopify products.json shape", () => {
    expect(ProductsFeedSchema.safeParse({ products: [product] }).success).toBe(true);
  });

  it.each([
    ["missing products", {}],
    ["variant without price", { products: [{ ...product, variants: [{ id: 11 }] }] }],
    ["no variants", { products: [{ ...product, variants: [] }] }],
    ["missing images", { products: [{ id: 1, handle: "tee", variants: product.variants }] }],
  ])("rejects %s", (_, body) => {
    expect(ProductsFeedSchema.safeParse(body).success).toBe(false);
  });
});

describe("shopifyFingerprint", () => {
  it("prefers header proofs", () => {
    expect(shopifyFingerprint(new Headers({ "x-shopid": "123" }))).toBe("header x-shopid");
    expect(shopifyFingerprint(new Headers({ "powered-by": "Shopify" }))).toBe("header powered-by");
  });

  it("ignores a non-Shopify powered-by header", () => {
    expect(shopifyFingerprint(new Headers({ "powered-by": "WordPress" }))).toBeNull();
  });

  it("falls back to homepage markers", () => {
    const html = '<link href="//shop.com/cdn/shop/t/1/assets/theme.css">';
    expect(shopifyFingerprint(new Headers(), html)).toBe("homepage /cdn/shop/");
  });

  it("returns null without any proof", () => {
    expect(shopifyFingerprint(new Headers(), "<html>plain</html>")).toBeNull();
  });
});

describe("permalinkResolves", () => {
  it.each([
    [200, null, true],
    [302, "https://shop.com/cart", true],
    [302, "/checkouts/cn/abc", true],
    [302, "https://shop.app/checkout/9861988414/cn/abc/en-sg/shoppay", true],
    [302, "https://shop.com/password", false],
    [302, "https://shop.com/challenge", false],
    [404, null, false],
    [302, null, false],
  ])("status %s to %s -> %s", (status, location, expected) => {
    expect(permalinkResolves(status, location)).toBe(expected);
  });
});

describe("currencyFrom", () => {
  it("reads /cart.js", () => expect(currencyFrom({ currency: "SGD" })).toBe("SGD"));
  it("falls back to the homepage Shopify.currency object", () => {
    expect(currencyFrom(null, 'Shopify.currency = {"active":"USD","rate":"1.0"};')).toBe("USD");
  });
  it("returns null when unknown", () => expect(currencyFrom({}, "<html></html>")).toBeNull());
});

describe("PoliteFetcher", () => {
  const noSleep = async () => {};
  const respond = (status: number, headers: Record<string, string> = {}) =>
    new Response("{}", { status, headers });

  it("waits out a 429 and then succeeds", async () => {
    const sleeps: number[] = [];
    const statuses = [429, 200];
    const http = new PoliteFetcher({
      minIntervalMs: 0,
      fetchImpl: (async () => respond(statuses.shift()!, { "retry-after": "5" })) as typeof fetch,
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect((await http.get("https://a.com/x")).status).toBe(200);
    expect(sleeps).toContain(5000);
  });

  it("gives up with RateLimitedError after repeated 429s", async () => {
    const http = new PoliteFetcher({
      minIntervalMs: 0,
      fetchImpl: (async () => respond(429)) as typeof fetch,
      sleep: noSleep,
    });
    await expect(http.get("https://a.com/x")).rejects.toBeInstanceOf(RateLimitedError);
  });

  it("retries network errors twice, then fails", async () => {
    let calls = 0;
    const http = new PoliteFetcher({
      minIntervalMs: 0,
      fetchImpl: (async () => {
        calls++;
        throw new Error("ECONNRESET");
      }) as typeof fetch,
      sleep: noSleep,
    });
    await expect(http.get("https://a.com/x")).rejects.toBeInstanceOf(FetchFailedError);
    expect(calls).toBe(3);
  });

  it("spaces requests by the minimum interval", async () => {
    const sleeps: number[] = [];
    const http = new PoliteFetcher({
      minIntervalMs: 1000,
      fetchImpl: (async () => respond(200)) as typeof fetch,
      sleep: async (ms) => void sleeps.push(ms),
    });
    await http.get("https://a.com/1");
    await http.get("https://a.com/2");
    expect(sleeps.length).toBe(1);
    expect(sleeps[0]).toBeGreaterThan(900);
  });

  it("sends an honest user agent", async () => {
    let ua = "";
    const http = new PoliteFetcher({
      minIntervalMs: 0,
      fetchImpl: (async (_: unknown, init?: RequestInit) => {
        ua = new Headers(init?.headers).get("user-agent") ?? "";
        return respond(200);
      }) as typeof fetch,
    });
    await http.get("https://a.com/x");
    expect(ua).toMatch(/^WingmanBot/);
  });
});
