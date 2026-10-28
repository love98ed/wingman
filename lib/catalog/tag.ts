import { z } from "zod";
import { generateStructured } from "@/lib/llm/client";
import type { ImageVerdict } from "./images";
import { CATEGORIES, FORMALITIES, OCCASIONS, type ShopifyProduct } from "./types";

export const TAG_BATCH_SIZE = 25;

export const ProductTagSchema = z.object({
  id: z.number(),
  menswear: z.boolean(),
  category: z.enum(CATEGORIES).nullable(),
  colour: z.string(),
  formality: z.enum(FORMALITIES),
  occasions: z.array(z.enum(OCCASIONS)),
});
export type ProductTag = z.infer<typeof ProductTagSchema>;

/** Claude sees short numbers (0-24) instead of 13-digit Shopify ids: fewer tokens, no id typos. */
export const TagBatchSchema = z.object({ products: z.array(ProductTagSchema.omit({ id: true }).extend({ n: z.number() })) });

const SYSTEM = `You tag products from Singapore menswear stores for an occasion stylist.
For each product return:
- menswear: true only for adult men's clothing, shoes, watches, glasses or accessories. False for women's, kids', unisex home goods, gift cards, gifts, grooming products, fabric swatches.
- category: top (shirts, tees, polos, knitwear), outerwear (jackets, blazers, overshirts, kimonos), bottom (trousers, chinos, jeans, shorts), shoes, watch, glasses, accessory (belts, ties, bags, cufflinks, caps); null if none fit.
- colour: the main colour in one or two plain words, e.g. "navy", "olive green".
- formality: casual, smart-casual or formal.
- occasions: any that genuinely suit it from date, interview, wedding, cny (Chinese New Year visiting), dnd (company dinner and dance), night-out. Empty if none.`;

function describe(p: ShopifyProduct, n: number) {
  const text = (p.body_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
  const price = p.variants[0]?.price ?? "";
  return { n, title: p.title, type: p.product_type ?? "", tags: p.tags.slice(0, 12), price, description: text };
}

/** Tag up to 25 products with Haiku. Returns tags for the ids Claude returned. */
export async function tagBatch(products: ShopifyProduct[]): Promise<ProductTag[]> {
  const result = await generateStructured({
    task: "tagging",
    label: `tag x${products.length}`,
    effort: "low",
    schema: TagBatchSchema,
    system: SYSTEM,
    content: [{ type: "text", text: JSON.stringify(products.map((p, n) => describe(p, n))) }],
  });
  return result.products.flatMap(({ n, ...tag }) => (products[n] ? [{ ...tag, id: products[n].id }] : []));
}

const ImageVerdictSchema = z.object({
  person_visible: z.boolean(),
  bare_arms_or_skin_visible: z.boolean(),
  single_garment: z.boolean(),
  front_view: z.boolean(),
  plain_background: z.boolean(),
});

/** Haiku vision check of a candidate try-on image. */
export async function judgeImage(url: string): Promise<ImageVerdict> {
  return generateStructured({
    task: "tagging",
    label: "image-check",
    effort: "low",
    schema: ImageVerdictSchema,
    content: [
      { type: "image", source: { type: "url", url } },
      {
        type: "text",
        text:
          "This is a product photo of a garment. Answer: is a person visible; is any bare arm, neck or other skin " +
          "of a person visible; does it show a single garment; is it a front view (not back or close-up detail); " +
          "is the background plain.",
      },
    ],
  });
}
