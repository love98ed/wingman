import { z } from "zod";
import type { PoliteFetcher } from "./polite-fetch";

/** The parts of a Shopify products.json product we use. Extra fields are ignored. */
export const ShopifyProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  handle: z.string(),
  body_html: z.string().nullish(),
  vendor: z.string().nullish(),
  product_type: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  updated_at: z.string(),
  options: z.array(z.object({ name: z.string(), position: z.number() })).default([]),
  variants: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      price: z.string(),
      available: z.boolean().default(true),
      option1: z.string().nullish(),
      option2: z.string().nullish(),
      option3: z.string().nullish(),
    }),
  ),
  images: z.array(
    z.object({
      src: z.string(),
      width: z.number().nullish(),
      height: z.number().nullish(),
      position: z.number().nullish(),
      alt: z.string().nullish(),
    }),
  ),
});
export type ShopifyProduct = z.infer<typeof ShopifyProductSchema>;

const PAGE_SIZE = 250;
const MAX_PAGES = 20;

/** Parse a products.json body, dropping products that don't match the expected shape. */
export function parseProductsPage(body: unknown): ShopifyProduct[] {
  const raw = z.object({ products: z.array(z.unknown()) }).parse(body).products;
  return raw.flatMap((p) => {
    const parsed = ShopifyProductSchema.safeParse(p);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Page through /products.json until a short page. */
export async function fetchAllProducts(http: PoliteFetcher, domain: string): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await http.get(`https://${domain}/products.json?limit=${PAGE_SIZE}&page=${page}`);
    if (res.status !== 200) throw new Error(`products.json page ${page} returned HTTP ${res.status}`);
    const products = parseProductsPage(await res.json());
    all.push(...products);
    if (products.length < PAGE_SIZE) break;
  }
  return all;
}

/** Index of the size option (option1/2/3), or null when the product has no size option. */
export function sizeOptionIndex(product: ShopifyProduct): 1 | 2 | 3 | null {
  const opt = product.options.find((o) => /size/i.test(o.name));
  return opt && opt.position >= 1 && opt.position <= 3 ? (opt.position as 1 | 2 | 3) : null;
}

export function variantSize(product: ShopifyProduct, variant: ShopifyProduct["variants"][number]): string {
  const idx = sizeOptionIndex(product);
  const value = idx ? variant[`option${idx}`] : null;
  return value ?? variant.title;
}
