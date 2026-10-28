import { toSgd } from "./fx";
import { variantSize } from "./shopify";
import type { Store } from "./stores";
import type { ProductTag } from "./tag";
import type { Category, Product, ShopifyProduct } from "./types";

/** Price of the cheapest in-stock variant, else the cheapest variant. */
export function listPrice(product: ShopifyProduct): number {
  const inStock = product.variants.filter((v) => v.available);
  const pool = inStock.length ? inStock : product.variants;
  return Math.min(...pool.map((v) => Number(v.price)));
}

export function productId(store: Store, product: ShopifyProduct) {
  return `${store.domain}-${product.id}`;
}

/** Product without a tier; tiers are assigned across the whole catalog afterwards. */
export type UntieredProduct = Omit<Product, "tier">;

export function buildProduct(
  store: Store,
  product: ShopifyProduct,
  tag: ProductTag & { category: Category },
  image: string,
): UntieredProduct {
  const currency = store.currency ?? "SGD";
  const originalPrice = listPrice(product);
  return {
    id: productId(store, product),
    store: store.domain,
    storeName: store.name,
    name: product.title,
    price: toSgd(originalPrice, currency),
    currency: "SGD",
    category: tag.category,
    originalPrice,
    originalCurrency: currency,
    colour: tag.colour,
    formality: tag.formality,
    occasions: tag.occasions,
    image,
    images: product.images.map((i) => i.src),
    url: `https://${store.domain}/products/${product.handle}`,
    variants: product.variants.map((v) => ({ id: v.id, size: variantSize(product, v), available: v.available })),
    updatedAt: product.updated_at,
  };
}

export const inStock = (p: Pick<Product, "variants">) => p.variants.some((v) => v.available);
