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
import { renderLook } from "./render";
import type { Look, LookItem, StyleEvent, StyleResult } from "./events";
import type { LookPick, ParsedOccasion, StyleRequest } from "./schemas";
import { fitCheck, parseOccasion, prepPlan, selectLooks } from "./steps";

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

/** CLAUDE.md section 6, steps 1 to 6. `emit` receives each event as it happens. */
export async function runStyle(
  photoBytes: Buffer,
  req: StyleRequest,
  emit: (event: StyleEvent) => void = () => {},
): Promise<StyleResult> {
  const started = Date.now();
  const lap = (label: string) => console.info(`[style] ${label} at ${((Date.now() - started) / 1000).toFixed(1)}s`);

  // 1. Occasion, and the photo crops (Claude finds the face)
  emit({ type: "progress", step: "reading" });
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
  emit({ type: "progress", step: "picking", detail: `${products.length} in-stock pieces` });
  const pool = buildPool(products, { ...occasion, seed: photo.hash });
  const rules = { maxBudget: req.maxBudget, hair: HAIR_STYLES, beard: BEARD_STYLES };
  let picks = await selectLooks({ occasion, sentence: req.occasion, pool, face: photo.closeFace });
  const errors = pickErrors(picks, pool, rules);
  if (errors.length) {
    console.warn(`[style] retrying selection: ${errors.join(" ")}`);
    picks = await selectLooks({ occasion, sentence: req.occasion, pool, face: photo.closeFace, errors });
  }
  // Keep only looks that pass on their own; a still-broken look is dropped rather than shown.
  const valid: LookPick[] = picks.filter((p) => pickErrors([p], pool, rules).length === 0);
  if (valid.length === 0) throw new Error("Could not build a look from the catalog for this request");
  lap(`selected ${valid.length} looks`);

  const itemsByLook: LookItems[] = valid.map((pick) => lookItems(pick, pool));
  const looks: Look[] = valid.map((pick, i) => ({
    name: pick.name,
    why: pick.why,
    items: SLOTS.flatMap((slot) => (itemsByLook[i][slot] ? [toItem(slot, itemsByLook[i][slot]!)] : [])),
    hair: pick.hair,
    beard: pick.beard,
    renders: { errors: [] },
    fitCheck: null,
    total: lookTotal(itemsByLook[i]),
  }));
  emit({ type: "looks", occasion, looks });

  // 4. Renders, streamed one by one, with the prep plan written in parallel
  emit({ type: "progress", step: "rendering" });
  const plans = skinPromise
    .then((skin) => prepPlan({ occasion, skin }).then((plan) => ({ plan, skin })))
    .then((p) => {
      emit({ type: "prep", prepPlan: p.plan, skinAnalysed: p.skin != null });
      return p;
    });
  const renders = await Promise.all(
    valid.map((pick, i) =>
      renderLook({
        photo,
        items: itemsByLook[i],
        hair: pick.hair,
        beard: pick.beard,
        onRender: (kind, url) => emit({ type: "render", look: i, kind, url }),
      }),
    ),
  );
  renders.forEach(({ outfit, hair, beard, errors }, i) => (looks[i].renders = { outfit, hair, beard, errors }));
  lap("rendered");

  // 5. Fit Check on the renders
  emit({ type: "progress", step: "scoring" });
  const checks = await fitCheck({
    occasion,
    looks: valid.map((pick, i) => ({
      name: pick.name,
      items: Object.values(itemsByLook[i]).map((p) => p!.name).join(", "),
      render: renders[i].outfitImage,
    })),
  });
  checks.forEach((c, i) => (looks[i].fitCheck = { score: Math.round(c.score * 10) / 10, reasoning: c.reasoning }));
  emit({ type: "fitcheck", checks: looks.map((l) => l.fitCheck!) });

  const { plan, skin } = await plans;
  lap("done");
  const result: StyleResult = { occasion, looks, prepPlan: plan, skinAnalysed: skin != null };
  emit({ type: "result", result });
  return result;
}
