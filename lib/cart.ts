/**
 * Cart and checkout (CLAUDE.md section 7). One Shopify cart permalink per store:
 * https://{store}/cart/{variantId}:{qty},{variantId}:{qty}
 * Safe to import from client components.
 */
import type { Product } from "@/lib/catalog/types";

type SizeChoice = { variantId: number; size: string };

/** What a size picker offers for one product: in-stock variants only. */
export function sizeChoices(variants: Product["variants"]): SizeChoice[] {
  const available = variants.filter((v) => v.available);
  const counts = new Map<string, number>();
  for (const v of available) counts.set(v.size, (counts.get(v.size) ?? 0) + 1);
  return available.map((v) => ({
    variantId: v.id,
    // Shopify names a product with no options "Default Title"
    size:
      v.size === "Default Title"
        ? "One size"
        : // The same size twice means another option (usually colour) differs: show the full title
          (counts.get(v.size) ?? 0) > 1 && v.title
          ? v.title
          : v.size,
  }));
}

/** No size to choose: the one variant can go straight in the cart. */
export const isOneSize = (sizes: SizeChoice[]) => sizes.length === 1 && sizes[0].size === "One size";

const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

/** A cart permalink for one store. Repeated variants are merged; bad input throws rather than link elsewhere. */
export function cartPermalink(store: string, lines: { variantId: number; qty: number }[]): string {
  if (!DOMAIN.test(store)) throw new Error(`Not a store domain: ${store}`);
  const merged = new Map<number, number>();
  for (const { variantId, qty } of lines) {
    if (!Number.isSafeInteger(variantId) || variantId <= 0) throw new Error(`Bad variant id: ${variantId}`);
    if (!Number.isInteger(qty) || qty < 1) throw new Error(`Bad quantity: ${qty}`);
    merged.set(variantId, (merged.get(variantId) ?? 0) + qty);
  }
  if (merged.size === 0) throw new Error("A cart needs at least one item");
  return `https://${store}/cart/${[...merged].map(([id, qty]) => `${id}:${qty}`).join(",")}`;
}

export type CartLine = {
  /** Product id; one line per product. */
  id: string;
  store: string;
  storeName: string;
  name: string;
  price: number;
  image: string;
  url: string;
  sizes: SizeChoice[];
  /** Null until a size is picked. */
  variantId: number | null;
  qty: number;
};

/** Most of one piece a cart line can hold. */
export const MAX_QTY = 5;

/** Sold out since it was added: no size left to buy, so it's left out of totals and checkout. */
export const isSoldOut = (line: Pick<CartLine, "sizes">) => line.sizes.length === 0;

/** Pieces counted with their quantities. */
export const pieceCount = (lines: Pick<CartLine, "qty">[]) => lines.reduce((sum, l) => sum + l.qty, 0);

type StoreCart = {
  store: string;
  storeName: string;
  lines: CartLine[];
  /** Pieces that can be bought, with quantities; sold-out lines aren't counted. */
  subtotal: number;
  /** Lines still waiting for a size. */
  missingSizes: number;
  /** Set once every piece that can be bought has a size. */
  checkoutUrl: string | null;
};

/**
 * Lines grouped by store in the order stores first appear, each with its own checkout link.
 * A sold-out line never blocks its store's checkout: it's simply left out.
 */
export function groupByStore(lines: CartLine[]): StoreCart[] {
  const groups = new Map<string, CartLine[]>();
  for (const line of lines) groups.set(line.store, [...(groups.get(line.store) ?? []), line]);
  return [...groups].map(([store, group]) => {
    const buyable = group.filter((l) => !isSoldOut(l));
    const missingSizes = buyable.filter((l) => l.variantId == null).length;
    return {
      store,
      storeName: group[0].storeName,
      lines: group,
      subtotal: Math.round(buyable.reduce((sum, l) => sum + l.price * l.qty, 0) * 100) / 100,
      missingSizes,
      checkoutUrl:
        buyable.length > 0 && missingSizes === 0
          ? cartPermalink(store, buyable.map((l) => ({ variantId: l.variantId!, qty: l.qty })))
          : null,
    };
  });
}
