import { z } from "zod";

/** CLAUDE.md 5b check 1: `{ products: [{ id, handle, variants: [{ id, price }], images: [...] }] }`. */
export const ProductsFeedSchema = z.object({
  products: z.array(
    z.object({
      id: z.number(),
      handle: z.string(),
      variants: z.array(z.object({ id: z.number(), price: z.string(), available: z.boolean().optional() })).min(1),
      images: z.array(z.unknown()),
    }),
  ),
});
export type ProductsFeed = z.infer<typeof ProductsFeedSchema>;

const HEADER_PROOFS = [
  ["x-shopid", () => true],
  ["x-shopify-stage", () => true],
  ["powered-by", (v: string) => /shopify/i.test(v)],
] as const;

const HTML_PROOFS = ["cdn.shopify.com", "/cdn/shop/", "Shopify.shop", "shopify-digital-wallet"];

/** CLAUDE.md 5b check 2. Returns a label like "header x-shopid", or null if no fingerprint. */
export function shopifyFingerprint(headers: Headers, html?: string): string | null {
  for (const [name, test] of HEADER_PROOFS) {
    const value = headers.get(name);
    if (value !== null && test(value)) return `header ${name}`;
  }
  if (html) {
    for (const marker of HTML_PROOFS) if (html.includes(marker)) return `homepage ${marker}`;
  }
  return null;
}

/**
 * CLAUDE.md 5b check 3: a cart permalink resolves with 200 or a redirect to the
 * cart or checkout. Shopify may send it to the store's /checkouts/... or to Shop
 * Pay at shop.app/checkout/..., both of which are working checkouts.
 */
export function permalinkResolves(status: number, location: string | null): boolean {
  if (status === 200) return true;
  if (status >= 300 && status < 400 && location) {
    const pathname = new URL(location, "https://store.invalid").pathname;
    return pathname.startsWith("/cart") || /\/checkouts?\//.test(pathname);
  }
  return false;
}

/** Short "host/path" of a redirect target, for logs. */
export function describeLocation(location: string | null): string {
  if (!location) return "no Location header";
  const url = new URL(location, "https://store.invalid");
  return `${url.host === "store.invalid" ? "" : url.host}${url.pathname}`.slice(0, 80);
}

/** Store currency from /cart.js, or from Shopify's currency object in the homepage HTML. */
export function currencyFrom(cartJson: unknown, html?: string): string | null {
  const fromCart = (cartJson as { currency?: unknown } | null)?.currency;
  if (typeof fromCart === "string" && /^[A-Z]{3}$/.test(fromCart)) return fromCart;
  const match = html?.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/);
  return match?.[1] ?? null;
}
