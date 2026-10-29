import "server-only";

import { AgentError } from "@/lib/agent/errors";
import type { LookItem, SwapEvent } from "@/lib/agent/events";
import { memo } from "@/lib/agent/memo";
import { allowedFormalities, buildPool, lookTotal, productLine, varied, type LookItems } from "@/lib/agent/pick/candidates";
import { renderLook } from "@/lib/agent/render";
import { fromClient, type SwapOptionsRequest, type SwapRequest } from "@/lib/agent/schemas";
import { SLOTS } from "@/lib/agent/slots";
import { fitCheck, pickAlternatives } from "@/lib/agent/steps";
import { loadCatalog } from "@/lib/catalog/repo";
import { preparePhoto } from "@/lib/photo/prepare";
import { supabaseAdmin } from "@/lib/supabase/server";
import { cachedFace, toItem } from "./style";

const OPTIONS = 6;

/** The look's products by slot, read fresh from the catalog. */
async function loadLook(items: { slot: (typeof SLOTS)[number]; id: string }[]): Promise<LookItems> {
  const products = await loadCatalog(supabaseAdmin(), { ids: items.map((i) => i.id) });
  const look: LookItems = {};
  for (const { slot, id } of items) {
    const product = products.find((p) => p.id === id);
    if (product) look[slot] = product;
  }
  return look;
}

/**
 * Up to 6 in-stock alternatives for one slot of a look: same tier, a formality that suits
 * the occasion, and cheap enough to keep the look under any budget cap. Claude picks a
 * varied set that goes with the rest of the look; cached per look and slot.
 */
export async function swapOptions(req: SwapOptionsRequest): Promise<LookItem[]> {
  const occasion = fromClient(req.occasion, req.tier);
  const db = supabaseAdmin();
  const [look, products] = await Promise.all([
    loadLook(req.items),
    loadCatalog(db, { inStock: true, tier: req.tier, categories: [req.slot], formalities: allowedFormalities(occasion.formality) }),
  ]);
  const current = look[req.slot];
  if (!current) throw new AgentError("NOT_FOUND", "That piece is no longer in the catalog.");

  const inLook = new Set(req.items.map((i) => i.id));
  const headroom = occasion.maxBudget != null ? occasion.maxBudget - (lookTotal(look) - current.price) : Infinity;
  const pool = buildPool(
    products.filter((p) => !inLook.has(p.id) && p.price <= headroom),
    { occasion: occasion.occasion, formality: occasion.formality, seed: current.id },
  );
  const candidates = pool[req.slot];
  if (candidates.length === 0) return [];

  const ids = await memo(
    {
      selfieHash: "swap",
      api: "swap-options",
      params: { ids: SLOTS.map((s) => look[s]?.id ?? null), slot: req.slot, occasion: occasion.occasion, constraints: occasion.constraints, headroom },
    },
    () =>
      pickAlternatives({
        occasion,
        slot: req.slot,
        current: `${current.name} (${current.colour})`,
        rest: SLOTS.filter((s) => s !== req.slot && look[s]).map((s) => `${s}: ${look[s]!.name} (${look[s]!.colour})`),
        candidates: candidates.map(productLine).join("\n"),
      }),
  );
  // Claude's picks first (only real candidates), then the best-ranked rest to fill six.
  const picked = ids.map((id) => candidates.find((p) => p.id === id)).filter((p) => p != null);
  const chosen = varied([...new Set([...picked, ...candidates])], OPTIONS);
  return chosen.map((p) => toItem(req.slot, p));
}

/**
 * Apply a swap: try the look on again and re-score it. Only tops and outerwear show in
 * the try-on, so other swaps hit the render cache and cost no units.
 */
export async function runSwap(photoBytes: Buffer, req: SwapRequest, emit: (event: SwapEvent) => void) {
  const occasion = fromClient(req.occasion, req.tier);
  const [photo, items] = await Promise.all([preparePhoto(photoBytes, cachedFace), loadLook(req.items)]);
  if (Object.keys(items).length !== req.items.length) throw new AgentError("NOT_FOUND", "One of those pieces is no longer in the catalog.");

  const renders = await renderLook({
    photo,
    items,
    hair: req.hair,
    beard: null,
    onRender: (kind, url) => {
      if (kind !== "beard") emit({ type: "render", kind, url });
    },
  });
  const params = { ids: SLOTS.map((s) => items[s]?.id ?? null), hair: req.hair, occasion: occasion.occasion, mock: !renders.outfitImage };
  const [check] = await memo({ selfieHash: photo.hash, api: "fit-check", params }, () =>
    fitCheck({
      occasion,
      looks: [{ name: req.name, items: Object.values(items).map((p) => p!.name).join(", "), render: renders.outfitImage }],
    }),
  );
  emit({ type: "fitcheck", check: { score: Math.round(check.score * 10) / 10, reasoning: check.reasoning } });
  emit({ type: "done" });
}
