import type { Category, ShopifyProduct } from "./types";

/** Categories rendered with clothes try-on. Only these need a clean garment image. */
export const TRY_ON_CATEGORIES: Category[] = ["top", "outerwear"];

type Image = ShopifyProduct["images"][number];

const GOOD = /flat|laydown|lay-down|ghost|packshot|front|cutout|still/i;
const BAD = /model|lifestyle|back|detail|close-?up|zoom|swatch|fabric|texture|look|outfit|campaign/i;
/** Size charts and guides are never garment photos. */
const UNUSABLE = /measure|size-?guide|sizing|size ?chart|guide|chart/i;

/** Long side YouCam accepts is 4096px; ask Shopify's CDN for a smaller copy. */
export const TRY_ON_WIDTH = 1600;

/**
 * Heuristic score for how likely an image is a clean, front-on product shot.
 * Higher is better. Vision checks the top candidates for try-on categories.
 */
export function imageScore(image: Image, index: number): number {
  const name = `${image.alt ?? ""} ${decodeURIComponent(image.src.split("?")[0].split("/").pop() ?? "")}`;
  if (UNUSABLE.test(name)) return -10;
  let score = 0;
  if (GOOD.test(name)) score += 3;
  if (BAD.test(name)) score -= 3;
  if (/back/i.test(name) && !/front/i.test(name)) score -= 2;
  const { width, height } = image;
  if (width && height) {
    if (Math.max(width, height) < 600) score -= 5; // too small to render well
    if (width > height * 1.3) score -= 2; // landscape: usually a banner or size chart
  }
  score -= index * 0.25; // stores usually lead with the hero shot
  return score;
}

/** Images ordered best first, skipping ones that can't be used at all. */
export function rankImages(product: ShopifyProduct): Image[] {
  return product.images
    .map((image, index) => ({ image, score: imageScore(image, index) }))
    .filter(({ score }) => score > -5)
    .sort((a, b) => b.score - a.score)
    .map(({ image }) => image);
}

/** Shopify CDN URL resized for try-on (keeps the original query). */
export function sizedUrl(src: string, width = TRY_ON_WIDTH): string {
  const url = new URL(src.startsWith("//") ? `https:${src}` : src);
  if (url.hostname.endsWith("shopify.com") || url.pathname.includes("/cdn/shop/")) {
    url.searchParams.set("width", String(width));
  }
  return url.toString();
}

export type ImageVerdict = {
  person_visible: boolean;
  bare_arms_or_skin_visible: boolean;
  single_garment: boolean;
  front_view: boolean;
  plain_background: boolean;
  /** Colour as seen in the photo; more reliable than the text tag for multi-colour products. */
  colour?: string;
};

/**
 * Whether an image is safe as a clothes try-on reference. YouCam copies a model's
 * bare arms (tattoos, skin) onto the user, so any visible skin rules an image out.
 */
export function usableForTryOn(v: ImageVerdict): boolean {
  return v.single_garment && v.front_view && !v.bare_arms_or_skin_visible;
}
