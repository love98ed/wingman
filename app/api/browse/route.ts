import { NextResponse } from "next/server";
import { SLOTS } from "@/lib/agent/catalog";
import type { BrowsePage } from "@/lib/agent/events";
import { BrowseQuerySchema } from "@/lib/agent/schemas";
import { toItem } from "@/lib/agent/style";
import { browse } from "@/lib/catalog/browse";
import { loadCatalog } from "@/lib/catalog/repo";
import type { Product } from "@/lib/catalog/types";
import { supabaseAdmin } from "@/lib/supabase/server";

const PAGE = 24;
/** The catalog changes only when the pipeline runs; a few minutes stale is fine for browsing. */
const TTL_MS = 10 * 60 * 1000;

let cached: { at: number; products: Promise<Product[]> } | undefined;

function catalog(): Promise<Product[]> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const products = loadCatalog(supabaseAdmin(), { inStock: true, categories: [...SLOTS] });
    cached = { at: Date.now(), products };
    // A failed read shouldn't stick for ten minutes
    products.catch(() => (cached = undefined));
  }
  return cached.products;
}

/** GET ?category=&tier=&price=&colour=&size=&store=&sort=&offset= → BrowsePage, 24 items at a time. */
export async function GET(request: Request) {
  const params = Object.fromEntries([...new URL(request.url).searchParams].filter(([, v]) => v !== ""));
  const query = BrowseQuerySchema.safeParse(params);
  if (!query.success) {
    return NextResponse.json({ error: "Those filters don't look right.", issues: query.error.issues }, { status: 400 });
  }
  try {
    const { offset, ...filter } = query.data;
    const { items, facets } = browse(await catalog(), filter);
    const page: BrowsePage = {
      items: items.slice(offset, offset + PAGE).map((p) => ({ ...toItem(filter.category, p), tier: p.tier })),
      total: items.length,
      facets,
    };
    return NextResponse.json(page);
  } catch (err) {
    console.error("[browse]", err);
    return NextResponse.json({ error: "We couldn't load the catalog. Please try again." }, { status: 500 });
  }
}
