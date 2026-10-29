import "server-only";

import { AgentError } from "@/lib/agent/errors";
import type { Look, LookItem, StyleEvent, StyleResult } from "@/lib/agent/events";
import { BEARD_STYLES, HAIR_STYLES } from "@/lib/agent/grooming";
import { memo } from "@/lib/agent/memo";
import { allowedFormalities, buildPool, distinctLooks, lookItems, lookTotal, pickErrors, type LookItems } from "@/lib/agent/pick/candidates";
import { renderLook } from "@/lib/agent/render";
import { fromClient, type LookPick, type ParsedOccasion, type RefineRequest, type StyleRequest } from "@/lib/agent/schemas";
import { SLOTS, type Slot } from "@/lib/agent/slots";
import { fitCheck, parseOccasion, prepPlan, refineOccasion, selectLooks, type PreviousLook } from "@/lib/agent/steps";
import { sizeChoices } from "@/lib/cart";
import { loadCatalog } from "@/lib/catalog/repo";
import { TIERS, type Product, type Tier } from "@/lib/catalog/types";
import { locateFace, preparePhoto, type FaceLocator, type PreparedPhoto } from "@/lib/photo/prepare";
import { supabaseAdmin } from "@/lib/supabase/server";
import { youcam } from "@/lib/youcam/index";

/** Face box cached per photo, so Price Compare and repeat runs skip the Claude face call. */
export const cachedFace: FaceLocator = (jpeg, width, height, hash) =>
  memo({ selfieHash: hash, api: "face-box", params: { width, height } }, () => locateFace(jpeg, width, height));

export const toItem = (slot: Slot, p: Product): LookItem => ({
  slot,
  id: p.id,
  name: p.name,
  store: p.store,
  storeName: p.storeName,
  price: p.price,
  colour: p.colour,
  image: p.image,
  url: p.url,
  sizes: sizeChoices(p.variants),
});

/** "oiliness 71, redness 96" from an SD skin analysis response, or null. */
function skinSummary(response: unknown): string | null {
  const output = (response as { data?: { results?: { output?: { type: string; ui_score: number }[] } } })?.data?.results
    ?.output;
  if (!Array.isArray(output) || output.length === 0) return null;
  return output.map((o) => `${o.type.replace(/_v\d+$/, "").replace(/_/g, " ")} ${Math.round(o.ui_score)}`).join(", ");
}

const timer = (label: string) => {
  const started = Date.now();
  return (step: string) => console.info(`[${label}] ${step} at ${((Date.now() - started) / 1000).toFixed(1)}s`);
};

/**
 * Tiers to draw from. A budget cap also opens the cheaper tiers, so "under S$300" can
 * still build a full look when the chosen tier alone can't.
 */
const tiersFor = (occasion: ParsedOccasion): Tier[] =>
  occasion.maxBudget != null ? TIERS.slice(0, TIERS.indexOf(occasion.budgetTier) + 1) : [occasion.budgetTier];

/** Fit Check scores below this drop a look. */
export const MIN_SCORE = 6;

/** Indexes of the looks worth showing: those scoring at least MIN_SCORE. Can be none. */
export function keepLooks(scores: number[]): number[] {
  return scores.flatMap((score, i) => (score >= MIN_SCORE ? [i] : []));
}

/**
 * CLAUDE.md section 6, steps 3 to 5: pick looks from the in-stock catalog, render them
 * on the photo and score them. Shared by the first run and by refine.
 */
async function buildLooks(args: {
  photo: PreparedPhoto;
  occasion: ParsedOccasion;
  sentence: string;
  refine?: { request: string; previous: PreviousLook[] };
  emit: (event: StyleEvent) => void;
  lap: (step: string) => void;
}): Promise<Look[]> {
  const { photo, occasion, emit, lap } = args;

  // 3. Looks from in-stock products in the tier
  const products = await loadCatalog(supabaseAdmin(), {
    inStock: true,
    tiers: tiersFor(occasion),
    categories: [...SLOTS],
    formalities: allowedFormalities(occasion.formality),
  });
  emit({ type: "progress", step: "picking", detail: `${products.length} in-stock pieces` });
  const pool = buildPool(products, { ...occasion, seed: photo.hash });
  const rules = { maxBudget: occasion.maxBudget, hair: HAIR_STYLES, beard: BEARD_STYLES };
  const select = (errors?: string[]) =>
    selectLooks({ occasion, sentence: args.sentence, pool, face: photo.closeFace, refine: args.refine, errors });
  let picks = await select();
  const errors = pickErrors(picks, pool, rules);
  if (errors.length) {
    console.warn(`[style] retrying selection: ${errors.join(" ")}`);
    picks = await select(errors);
  }
  // Keep only looks that pass on their own; a still-broken or repeated look is dropped rather than shown.
  const valid: LookPick[] = distinctLooks(picks.filter((p) => pickErrors([p], pool, rules).length === 0));
  if (valid.length === 0) {
    throw new AgentError(
      "NO_LOOKS",
      occasion.maxBudget != null
        ? `We couldn't build a full look for S$${occasion.maxBudget} or less from the stores. Try a higher budget.`
        : "We couldn't build a look from the stores for that. Try wording it differently.",
    );
  }
  lap(`selected ${valid.length} looks`);

  const itemsByLook: LookItems[] = valid.map((pick) => lookItems(pick, pool));
  const looks: Look[] = valid.map((pick, i) => ({
    name: pick.name,
    // A budget cap can mix tiers; the look sits in the dearest tier it uses.
    tier: TIERS[Math.max(...Object.values(itemsByLook[i]).map((p) => TIERS.indexOf(p!.tier)))],
    why: pick.why,
    items: SLOTS.flatMap((slot) => (itemsByLook[i][slot] ? [toItem(slot, itemsByLook[i][slot]!)] : [])),
    hair: pick.hair,
    beard: pick.beard,
    renders: { errors: [] },
    fitCheck: null,
    total: lookTotal(itemsByLook[i]),
  }));
  emit({ type: "looks", occasion, looks });

  // 4. Renders, streamed one by one
  emit({ type: "progress", step: "rendering" });
  const renders = await Promise.all(
    valid.map((pick, i) =>
      renderLook({
        photo,
        items: itemsByLook[i],
        hair: pick.hair,
        beard: pick.beard,
        onRender: (kind, url) => emit({ type: "render", look: i, kind, url }),
        onFail: (kind, code) => emit({ type: "renderFailed", look: i, kind, code }),
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

  // A weak look does more harm than showing fewer: drop those the Fit Check scored low,
  // and say so plainly when none are good enough.
  const keep = keepLooks(looks.map((l) => l.fitCheck!.score));
  if (keep.length === 0) {
    throw new AgentError(
      "NO_LOOKS",
      "None of the looks Wingman put together scored well enough to show you. Try another budget, or describe the occasion differently.",
    );
  }
  if (keep.length < looks.length) {
    lap(`dropped ${looks.length - keep.length} low-scoring look(s)`);
    emit({ type: "prune", keep, dropped: looks.length - keep.length });
  }
  emit({ type: "ready" });
  return keep.map((i) => looks[i]);
}

/** CLAUDE.md section 6, steps 1 to 6. `emit` receives each event as it happens. */
export async function runStyle(
  photoBytes: Buffer,
  req: StyleRequest,
  emit: (event: StyleEvent) => void = () => {},
): Promise<StyleResult> {
  const lap = timer("style");

  // 1. Occasion, and the photo crops (Claude finds the face)
  emit({ type: "progress", step: "reading" });
  const [parsed, photo] = await Promise.all([parseOccasion(req.occasion), preparePhoto(photoBytes, cachedFace)]);
  const occasion: ParsedOccasion = { ...parsed, budgetTier: req.tier, maxBudget: req.maxBudget };
  lap(`parsed ${occasion.occasion}/${occasion.formality}`);

  // 2. Skin analysis (cached per photo), then the prep plan, alongside the looks.
  // Never blocks: glasses or angle failures fall back to a general plan.
  const plans = youcam()
    .analyzeSkin({ photo: photo.closeFace, selfieHash: photo.hash })
    .then((r) => skinSummary(r.response))
    .catch((err: Error) => {
      console.warn(`[style] skin analysis skipped: ${err.message}`);
      return null;
    })
    .then((skin) => prepPlan({ occasion, skin }).then((plan) => ({ plan, skin })))
    .then((p) => {
      emit({ type: "prep", prepPlan: p.plan, skinAnalysed: p.skin != null });
      return p;
    });
  // Marks the plan handled if the looks fail first; it is still awaited below.
  plans.catch(() => undefined);

  const looks = await buildLooks({ photo, occasion, sentence: req.occasion, emit, lap });
  const { plan, skin } = await plans;
  lap("done");
  const result: StyleResult = { occasion, looks, prepPlan: plan, skinAnalysed: skin != null };
  emit({ type: "result", result });
  return result;
}

/**
 * Refine: apply one chat request ("more casual", "under S$300", "no white sneakers") to the
 * occasion, then re-run steps 3 to 5 with the previous looks as context. The prep plan stays.
 */
export async function runRefine(photoBytes: Buffer, req: RefineRequest, emit: (event: StyleEvent) => void) {
  const lap = timer("refine");
  emit({ type: "progress", step: "reading" });
  const current = fromClient(req.occasion, req.tier);
  const [update, photo] = await Promise.all([
    refineOccasion({ occasion: current, sentence: req.sentence, message: req.message, previous: req.previous }),
    preparePhoto(photoBytes, cachedFace),
  ]);
  // Turn down what can't or shouldn't be done before spending anything on new looks or renders
  if (update.verdict === "reject") throw new AgentError("REJECTED", update.reply);
  emit({ type: "refined", reply: update.reply });
  const occasion: ParsedOccasion = {
    ...current,
    formality: update.formality,
    setting: update.setting,
    constraints: update.constraints,
    maxBudget: update.maxBudget ?? undefined,
  };
  lap(`refined to ${occasion.formality}${occasion.maxBudget ? `, max S$${occasion.maxBudget}` : ""}`);
  await buildLooks({ photo, occasion, sentence: req.sentence, refine: { request: req.message, previous: req.previous }, emit, lap });
  lap("done");
}
