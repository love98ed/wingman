/**
 * Verify every store in fixtures/stores.json per CLAUDE.md 5b:
 *   1. /products.json returns the expected JSON shape
 *   2. a Shopify fingerprint in the headers or homepage
 *   3. a cart permalink resolves
 * Failing stores are removed and logged to fixtures/stores-removed.json.
 * Rate-limited (429) stores are NOT removed: 429 is about our IP, not the store.
 * They stay unverified and are re-checked on the next run.
 *
 *   npm run stores:check
 */
import { appendRemoved, readStores, writeStores, type Store } from "@/lib/catalog/stores";
import { FetchFailedError, PoliteFetcher, RateLimitedError } from "@/lib/catalog/polite-fetch";
import { currencyFrom, describeLocation, permalinkResolves, ProductsFeedSchema, shopifyFingerprint } from "@/lib/catalog/verify";

type Outcome =
  | { kind: "kept"; store: Store }
  | { kind: "pending"; store: Store }
  | { kind: "removed"; store: Store; reason: string };

const http = new PoliteFetcher({ log: console.info });
const today = new Date().toISOString().slice(0, 10);

class Fail extends Error {}

async function text(res: Response) {
  return res.text().catch(() => "");
}

async function check(store: Store): Promise<Outcome> {
  try {
    // 1. Product feed (one page of up to 250 also gives the count estimate).
    const feedRes = await http.get(`https://${store.domain}/products.json?limit=250`);
    if (feedRes.status !== 200) throw new Fail(`products.json returned HTTP ${feedRes.status}`);
    const host = new URL(feedRes.url).host;
    const body = await text(feedRes);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Fail("products.json is not JSON");
    }
    const feed = ProductsFeedSchema.safeParse(json);
    if (!feed.success) throw new Fail("products.json has an unexpected shape");
    const products = feed.data.products;
    if (products.length === 0) throw new Fail("zero products");

    // 2. Shopify fingerprint: headers first, homepage HTML if needed.
    let html: string | undefined;
    let proof = shopifyFingerprint(feedRes.headers);
    if (!proof) {
      html = await text(await http.get(`https://${host}/`));
      proof = shopifyFingerprint(new Headers(), html);
    }
    if (!proof) throw new Fail("no Shopify fingerprint");

    // 3. Cart permalink with an in-stock variant where possible.
    const variants = products.flatMap((p) => p.variants);
    const variant = variants.find((v) => v.available) ?? variants[0];
    const cart = await http.get(`https://${host}/cart/${variant.id}:1`, { redirect: "manual" });
    if (!permalinkResolves(cart.status, cart.headers.get("location"))) {
      const where = cart.status >= 300 && cart.status < 400 ? ` to ${describeLocation(cart.headers.get("location"))}` : "";
      throw new Fail(`cart permalink returned HTTP ${cart.status}${where}`);
    }

    // Currency (needed for SGD conversion). Not a removal reason on its own.
    const cartJson = await http
      .get(`https://${host}/cart.js`)
      .then((r) => r.json())
      .catch(() => null);
    if (!currencyFrom(cartJson) && !html) html = await text(await http.get(`https://${host}/`));
    const currency = currencyFrom(cartJson, html) ?? undefined;

    return {
      kind: "kept",
      store: {
        ...store,
        domain: host,
        verified: true,
        shopifyProof: proof,
        currency,
        productCountEstimate: products.length >= 250 ? "250+" : String(products.length),
        checkedAt: today,
        pendingReason: undefined,
      },
    };
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return { kind: "pending", store: { ...store, verified: false, pendingReason: "rate limited (429)", checkedAt: today } };
    }
    if (err instanceof Fail) return { kind: "removed", store, reason: err.message };
    if (err instanceof FetchFailedError) return { kind: "removed", store, reason: "timeout or network error after 2 retries" };
    throw err;
  }
}

async function main() {
  let stores = await readStores();
  const outcomes: Outcome[] = [];

  for (const store of [...stores]) {
    console.info(`Checking ${store.domain} ...`);
    const outcome = await check(store);
    outcomes.push(outcome);

    if (outcome.kind === "removed") {
      stores = stores.filter((s) => s.domain !== store.domain);
      await appendRemoved({ domain: store.domain, name: store.name, reason: outcome.reason, removedAt: today });
    } else {
      stores = stores.map((s) => (s.domain === store.domain ? outcome.store : s));
    }
    await writeStores(stores); // save after every store so an interrupted run keeps its progress
  }

  console.info(`\n${"Store".padEnd(28)}${"Result".padEnd(10)}${"Products".padEnd(10)}${"Currency".padEnd(10)}Detail`);
  for (const o of outcomes) {
    const s = o.store;
    const detail = o.kind === "kept" ? s.shopifyProof : o.kind === "pending" ? s.pendingReason : o.reason;
    console.info(
      `${s.domain.padEnd(28)}${o.kind.padEnd(10)}${(s.productCountEstimate ?? "-").padEnd(10)}${(s.currency ?? "-").padEnd(10)}${detail}`,
    );
  }
  const count = (k: Outcome["kind"]) => outcomes.filter((o) => o.kind === k).length;
  console.info(`\nKept ${count("kept")}, pending ${count("pending")}, removed ${count("removed")}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
