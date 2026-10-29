import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256 } from "@/lib/utils/hash";
import type { ShopifyProduct } from "./shopify";
import type { ProductTag } from "./tag";

/** What the pipeline has decided about one product. An absent `image` means not checked yet. */
export type TagEntry = { tag?: ProductTag; image?: string | null; imageColour?: string };

type Row = {
  product_id: string;
  store: string;
  source_hash: string;
  tag: ProductTag | null;
  image_checked: boolean;
  image: string | null;
  image_colour: string | null;
};

const PAGE = 1000;
const WRITE_BATCH = 500;

/**
 * Hash of everything the tagger and image check read. Shopify bumps updated_at on every stock
 * change, so that can't be the key; this changes only when the product itself does.
 */
export function sourceHash(p: ShopifyProduct): string {
  const images = p.images.map((i) => i.src.split("?")[0]);
  return sha256(JSON.stringify([p.title, p.product_type ?? "", p.tags, p.body_html ?? "", images]));
}

/** One store's tags from the catalog_tags table. `save` writes the entries changed since the last save. */
export class TagCache {
  private dirty = new Set<string>();

  private constructor(
    private db: SupabaseClient,
    private store: string,
    private entries: Map<string, { hash: string; entry: TagEntry }>,
  ) {}

  static async load(db: SupabaseClient, store: string): Promise<TagCache> {
    const entries = new Map<string, { hash: string; entry: TagEntry }>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("catalog_tags")
        .select("product_id, source_hash, tag, image_checked, image, image_colour")
        .eq("store", store)
        .order("product_id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Tag cache read failed: ${error.message}`);
      for (const r of data as Row[]) {
        entries.set(r.product_id, {
          hash: r.source_hash,
          entry: {
            tag: r.tag ?? undefined,
            image: r.image_checked ? r.image : undefined,
            imageColour: r.image_colour ?? undefined,
          },
        });
      }
      if (data.length < PAGE) break;
    }
    return new TagCache(db, store, entries);
  }

  /** The entry for a product, empty if it changed since it was tagged. Always the same object, so parallel work can assign into it. */
  entry(p: ShopifyProduct): TagEntry {
    const id = `${this.store}-${p.id}`;
    const hash = sourceHash(p);
    const cached = this.entries.get(id);
    if (cached?.hash === hash) return cached.entry;
    const fresh = { hash, entry: {} };
    this.entries.set(id, fresh);
    return fresh.entry;
  }

  /** Mark a product's entry for the next save. */
  touch(p: ShopifyProduct) {
    this.dirty.add(`${this.store}-${p.id}`);
  }

  async save(): Promise<void> {
    const rows: Row[] = [...this.dirty].map((id) => {
      const { hash, entry } = this.entries.get(id)!;
      return {
        product_id: id,
        store: this.store,
        source_hash: hash,
        tag: entry.tag ?? null,
        image_checked: entry.image !== undefined,
        image: entry.image ?? null,
        image_colour: entry.imageColour ?? null,
      };
    });
    this.dirty.clear();
    for (let i = 0; i < rows.length; i += WRITE_BATCH) {
      const { error } = await this.db.from("catalog_tags").upsert(rows.slice(i, i + WRITE_BATCH));
      if (error) throw new Error(`Tag cache write failed: ${error.message}`);
    }
  }
}
