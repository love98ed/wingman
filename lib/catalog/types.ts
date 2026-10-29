import { z } from "zod";

export const CATEGORIES = ["top", "outerwear", "bottom", "shoes", "watch", "glasses", "accessory"] as const;
export type Category = (typeof CATEGORIES)[number];

export const TIERS = ["budget", "mid", "luxury"] as const;
export type Tier = (typeof TIERS)[number];

export const FORMALITIES = ["casual", "smart-casual", "formal"] as const;
export type Formality = (typeof FORMALITIES)[number];

export const OCCASIONS = ["date", "interview", "wedding", "cny", "dnd", "night-out"] as const;
export type Occasion = (typeof OCCASIONS)[number];

/** CLAUDE.md section 5. */
export type Product = {
  id: string;
  store: string;
  storeName: string;
  name: string;
  price: number;
  currency: "SGD";
  tier: Tier;
  category: Category;
  originalPrice: number;
  originalCurrency: string;
  colour: string;
  formality: Formality;
  occasions: Occasion[];
  image: string;
  images: string[];
  url: string;
  /** `title` is Shopify's full variant title ("Navy / M"); it tells colour variants of one size apart. */
  variants: { id: number; size: string; title?: string; available: boolean }[];
  updatedAt: string;
};

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
