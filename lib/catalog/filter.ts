import { sizeOptionIndex } from "./shopify";
import type { ShopifyProduct } from "./shopify";

/**
 * Cheap keyword pre-filter before Claude tagging. Removes products that are
 * clearly not menswear (kids, womenswear, gift cards, home goods). Anything it
 * lets through is still checked by the tagger, which can mark it non-menswear.
 */
const EXCLUDE = [
  /\bkids?\b/,
  /\bboys?\b/,
  /\bgirls?\b/,
  /\bbaby\b/,
  /\btoddler/,
  /\binfant/,
  /\bwom[ae]n'?s?\b/,
  /\bladies\b/,
  /\bdress(es)?\b/,
  /\bskirts?\b/,
  /\bblouses?\b/,
  /\bcrop top\b/,
  /\bkaftan\b/,
  /\bgift ?cards?\b/,
  /\bvouchers?\b/,
  /\bpaja?mas?\b/,
  /\bsleepwear\b/,
  /\bcandles?\b/,
  /\bmugs?\b/,
  /\btowels?\b/,
  /\bposters?\b/,
  /\bstickers?\b/,
];

/** Kids sizes like "3Y", "5 Y", "12M". */
const KIDS_SIZE = /^\s*\d{1,2}\s?(y|yrs?|m)\s*$/i;

export type FilterResult = { keep: true } | { keep: false; reason: string };

export function prefilterMenswear(product: ShopifyProduct): FilterResult {
  const text = [product.title, product.product_type ?? "", ...product.tags].join(" | ").toLowerCase();
  for (const re of EXCLUDE) {
    const match = text.match(re);
    if (match) return { keep: false, reason: `keyword "${match[0]}"` };
  }

  const sizeIdx = sizeOptionIndex(product);
  const sizes = product.variants.map((v) => (sizeIdx ? v[`option${sizeIdx}`] : v.title) ?? "");
  if (sizes.length > 0 && sizes.every((s) => KIDS_SIZE.test(s) || /\/\s*\d{1,2}\s?y\b/i.test(s))) {
    return { keep: false, reason: "kids sizes" };
  }
  if (product.images.length === 0) return { keep: false, reason: "no images" };
  return { keep: true };
}
