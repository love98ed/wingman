import "server-only";

import { loadCatalog } from "@/lib/catalog/repo";
import { TIERS, type Tier } from "@/lib/catalog/types";
import { preparePhoto } from "@/lib/photo/prepare";
import { supabaseAdmin } from "@/lib/supabase/server";
import { allowedFormalities, lookTotal, SLOTS, type LookItems } from "./catalog";
import type { CompareEvent, TierVersion } from "./events";
import { resolveTier, tierPickErrors, tierPool, type TierPool } from "./match";
import { memo } from "./memo";
import { renderLook } from "./render";
import { fromClient, type CompareRequest, type TierPick } from "./schemas";
import { fitCheck, matchTiers } from "./steps";
import { cachedFace, toItem } from "./style";

const itemIds = (items: LookItems) => SLOTS.map((slot) => items[slot]?.id ?? null);

/**
 * Price Compare: the same look rebuilt at the other two tiers, each slot from its own
 * category tier, then tried on and scored. Shared garments hit the render cache (zero units),
 * and the tier picks and Fit Checks are cached per photo, so a second compare is near instant.
 */
export async function runCompare(photoBytes: Buffer, req: CompareRequest, emit: (event: CompareEvent) => void) {
  const started = Date.now();
  const lap = (label: string) => console.info(`[compare] ${label} at ${((Date.now() - started) / 1000).toFixed(1)}s`);
  const occasion = fromClient(req.occasion, req.tier);
  const db = supabaseAdmin();
  const slots = req.items.map((i) => i.slot);

  const [photo, originals, products] = await Promise.all([
    preparePhoto(photoBytes, cachedFace),
    loadCatalog(db, { ids: req.items.map((i) => i.id) }),
    loadCatalog(db, { inStock: true, categories: slots, formalities: allowedFormalities(occasion.formality) }),
  ]);
  const look: LookItems = {};
  for (const { slot, id } of req.items) {
    const product = originals.find((p) => p.id === id);
    if (product) look[slot] = product;
  }
  if (!look.top && !look.outerwear) throw new Error("The look's pieces are no longer in the catalog");

  const targets = TIERS.filter((t) => t !== req.tier);
  const pools = Object.fromEntries(targets.map((t) => [t, tierPool(look, products, t, photo.hash)])) as Record<Tier, TierPool>;
  const picks = await memo(
    { selfieHash: photo.hash, api: "tier-match", params: { ids: itemIds(look), from: req.tier, occasion: occasion.occasion } },
    async () => {
      const errorsFor = (picks: TierPick[]) =>
        targets.flatMap((t) => {
          const pick = picks.find((p) => p.tier === t);
          return pick ? tierPickErrors(pick, pools[t]) : [`Missing the ${t} version.`];
        });
      let picks = await matchTiers({ occasion, look, from: req.tier, pools });
      const errors = errorsFor(picks);
      if (errors.length) {
        console.warn(`[compare] retrying match: ${errors.join(" ")}`);
        picks = await matchTiers({ occasion, look, from: req.tier, pools, errors });
      }
      return picks;
    },
  );
  lap("matched");

  // Anything still invalid falls back to the closest candidate, so every column is complete.
  const versions = targets.map((tier) => {
    const pick = picks.find((p) => p.tier === tier);
    const items = resolveTier(look, pools[tier], pick);
    const version: TierVersion = {
      tier,
      items: SLOTS.flatMap((slot) => (items[slot] ? [toItem(slot, items[slot]!)] : [])),
      total: lookTotal(items),
      note: pick?.note ?? "",
      renders: { errors: [] },
      fitCheck: null,
    };
    return { version, items };
  });
  emit({ type: "versions", versions: versions.map((v) => v.version) });

  await Promise.all(
    versions.map(async ({ version, items }) => {
      const renders = await renderLook({
        photo,
        items,
        hair: req.hair,
        beard: null,
        onRender: (kind, url) => {
          if (kind !== "beard") emit({ type: "render", tier: version.tier, kind, url });
        },
      });
      const params = { ids: itemIds(items), hair: req.hair, occasion: occasion.occasion, mock: !renders.outfitImage };
      const [check] = await memo({ selfieHash: photo.hash, api: "fit-check", params }, () =>
        fitCheck({
          occasion,
          looks: [{ name: req.name, items: Object.values(items).map((p) => p!.name).join(", "), render: renders.outfitImage }],
        }),
      );
      emit({ type: "fitcheck", tier: version.tier, check: { score: Math.round(check.score * 10) / 10, reasoning: check.reasoning } });
    }),
  );
  lap("done");
  emit({ type: "done" });
}
