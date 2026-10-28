import "server-only";

import { loadCatalog } from "@/lib/catalog/repo";
import type { Product } from "@/lib/catalog/types";
import { preparePhoto } from "@/lib/photo/prepare";
import { supabaseAdmin } from "@/lib/supabase/server";
import { youcam } from "@/lib/youcam";
import {
  allowedFormalities,
  buildPool,
  lookItems,
  lookTotal,
  pickErrors,
  SLOTS,
  type LookItems,
  type Slot,
} from "./catalog";
import { BEARD_STYLES, HAIR_STYLES } from "./grooming";
import { renderLook, type LookRenders } from "./render";
import type { LookPick, ParsedOccasion, PrepPlan, StyleRequest } from "./schemas";
import { fitCheck, parseOccasion, prepPlan, selectLooks } from "./steps";

export type LookItem = {
  slot: Slot;
  id: string;
  name: string;
  store: string;
  storeName: string;
  price: number;
  image: string;
  url: string;
  /** In-stock sizes only. */
  sizes: { variantId: number; size: string }[];
};

export type Look = {
  name: string;
  why: string;
  items: LookItem[];
  hair: string | null;
  beard: string | null;
  renders: Omit<LookRenders, "outfitImage">;
  fitCheck: { score: number; reasoning: string };
  total: number;
};

export type StyleResult = {
  occasion: ParsedOccasion;
  looks: Look[];
  prepPlan: PrepPlan;
  /** False when skin analysis failed (e.g. glasses, angle); the prep plan is then general. */
  skinAnalysed: boolean;
};

const toItem = (slot: Slot, p: Product): LookItem => ({
  slot,
  id: p.id,
  name: p.name,
  store: p.store,
  storeName: p.storeName,
  price: p.price,
  image: p.image,
  url: p.url,
  sizes: p.variants.filter((v) => v.available).map((v) => ({ variantId: v.id, size: v.size })),
});

/** "oiliness 71, redness 96" from an SD skin analysis response, or null. */
function skinSummary(response: unknown): string | null {
  const output = (response as { data?: { results?: { output?: { type: string; ui_score: number }[] } } })?.data?.results
    ?.output;
  if (!Array.isArray(output) || output.length === 0) return null;
  return output.map((o) => `${o.type.replace(/_v\d+$/, "").replace(/_/g, " ")} ${Math.round(o.ui_score)}`).join(", ");
}

/** CLAUDE.md section 6, steps 1 to 6. */
export async function runStyle(photoBytes: Buffer, req: StyleRequest): Promise<StyleResult> {
  const started = Date.now();
  const lap = (label: string) => console.info(`[style] ${label} at ${((Date.now() - started) / 1000).toFixed(1)}s`);

  // 1. Occasion, and the photo crops (Claude finds the face)
  const [parsed, photo] = await Promise.all([parseOccasion(req.occasion), preparePhoto(photoBytes)]);
  const occasion: ParsedOccasion = { ...parsed, budgetTier: req.tier, maxBudget: req.maxBudget };
  lap(`parsed ${occasion.occasion}/${occasion.formality}`);

  // 2. Skin analysis (cached per photo). Never blocks: glasses or angle failures fall back to a general plan.
  const skinPromise = youcam()
    .analyzeSkin({ photo: photo.closeFace, selfieHash: photo.hash })
    .then((r) => skinSummary(r.response))
    .catch((err: Error) => {
      console.warn(`[style] skin analysis skipped: ${err.message}`);
      return null;
    });

  // 3. Looks from in-stock products in the tier
  const products = await loadCatalog(supabaseAdmin(), {
    inStock: true,
    tier: req.tier,
    categories: [...SLOTS],
    formalities: allowedFormalities(occasion.formality),
  });
  const pool = buildPool(products, { ...occasion, seed: photo.hash });
  const rules = { maxBudget: req.maxBudget, hair: HAIR_STYLES, beard: BEARD_STYLES };
  let picks = await selectLooks({ occasion, sentence: req.occasion, pool, face: photo.closeFace });
  let errors = pickErrors(picks, pool, rules);
  if (errors.length) {
    console.warn(`[style] retrying selection: ${errors.join(" ")}`);
    picks = await selectLooks({ occasion, sentence: req.occasion, pool, face: photo.closeFace, errors });
    errors = pickErrors(picks, pool, rules);
  }
  // Keep only looks that pass on their own; a still-broken look is dropped rather than shown.
  const valid: LookPick[] = picks.filter((p) => pickErrors([p], pool, rules).length === 0);
  if (valid.length === 0) throw new Error("Could not build a look from the catalog for this request");
  lap(`selected ${valid.length} looks`);

  // 4. Renders, with the prep plan written in parallel
  const plans = skinPromise.then((skin) => prepPlan({ occasion, skin }).then((plan) => ({ plan, skin })));
  const renders = await Promise.all(
    valid.map((pick) => renderLook({ photo, items: lookItems(pick, pool), hair: pick.hair, beard: pick.beard })),
  );
  lap("rendered");

  // 5. Fit Check on the renders
  const itemsByLook: LookItems[] = valid.map((pick) => lookItems(pick, pool));
  const checks = await fitCheck({
    occasion,
    looks: valid.map((pick, i) => ({
      name: pick.name,
      items: Object.values(itemsByLook[i]).map((p) => p!.name).join(", "),
      render: renders[i].outfitImage,
    })),
  });
  const { plan, skin } = await plans;
  lap("done");

  return {
    occasion,
    looks: valid.map((pick, i) => {
      const { outfit, hair, beard, errors } = renders[i];
      const items = itemsByLook[i];
      return {
        name: pick.name,
        why: pick.why,
        items: SLOTS.flatMap((slot) => (items[slot] ? [toItem(slot, items[slot]!)] : [])),
        hair: pick.hair,
        beard: pick.beard,
        renders: { outfit, hair, beard, errors },
        fitCheck: { score: Math.round(checks[i].score * 10) / 10, reasoning: checks[i].reasoning },
        total: lookTotal(items),
      };
    }),
    prepPlan: plan,
    skinAnalysed: skin != null,
  };
}
