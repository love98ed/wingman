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
