import "server-only";

import type { LookItems } from "@/lib/agent/pick/candidates";
import { sizedUrl } from "@/lib/catalog/pipeline/images";
import { headShouldersFrom, type PreparedPhoto } from "@/lib/photo/prepare";
import { renderUrl, youcam } from "@/lib/youcam";
import { YouCamError, type YouCamErrorCode } from "@/lib/youcam/errors";
import type { RenderKind } from "./events";
import { BEARD_TEMPLATES, HAIR_TEMPLATES } from "./grooming";

type LookRenders = {
  /** Clothes try-on on the whole photo. */
  outfit?: string;
  /** Hair try-on chained on the outfit render (head and shoulders). */
  hair?: string;
  /** Beard try-on on the close face crop, shown beside the others. */
  beard?: string;
  /** Raw outfit image, for the Fit Check. */
  outfitImage?: Buffer;
  errors: YouCamErrorCode[];
};

/**
 * Step 4: clothes try-on with the outer layer, then hair on that render, then beard.
 * Watches, bottoms and shoes are product cards only (see docs: YouCam framing limits).
 */
export async function renderLook(args: {
  photo: PreparedPhoto;
  items: LookItems;
  hair: string | null;
  beard: string | null;
  /** Called as each render lands, so the client can show the outfit before hair and beard finish. */
  onRender?: (kind: RenderKind, url: string) => void;
}): Promise<LookRenders> {
  const yc = youcam();
  const { photo } = args;
  const out: LookRenders = { errors: [] };
  const garment = args.items.outerwear ?? args.items.top;

  const attempt = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (err) {
      // A bad photo fails every render the same way; let the caller tell the user.
      if (err instanceof YouCamError && (err.code === "NO_FACE" || err.code === "QUOTA")) throw err;
      console.warn(`[render] ${(err as Error).message}`);
      out.errors.push(err instanceof YouCamError ? err.code : "UNKNOWN");
      return undefined;
    }
  };

  const beard = args.beard
    ? attempt(() =>
        yc.tryOnBeard({ photo: photo.closeFace, selfieHash: photo.hash, templateId: BEARD_TEMPLATES[args.beard!] }),
      )
    : undefined;
  // Marks the beard promise handled if clothes throws first; it is still awaited below.
  beard?.catch(() => undefined);

  const clothes = garment
    ? await attempt(() =>
        yc.tryOnClothes({
          photo: photo.full,
          selfieHash: photo.hash,
          productId: garment.id,
          garmentUrl: sizedUrl(garment.image),
        }),
      )
    : undefined;
  if (clothes) {
    out.outfit = await renderUrl(clothes);
    if (out.outfit) args.onRender?.("outfit", out.outfit);
    // Mock fixtures show a different outfit, so the Fit Check would judge the wrong clothes.
    if (clothes.source !== "mock") out.outfitImage = clothes.image;
  }

  if (args.hair) {
    const source = clothes?.image ? await headShouldersFrom(clothes.image, photo) : photo.headShoulders;
    const hair = await attempt(() =>
      yc.tryOnHair({
        photo: source,
        selfieHash: photo.hash,
        templateId: HAIR_TEMPLATES[args.hair!],
        source: clothes?.image && garment ? `clothes:${garment.id}` : "photo",
        fixture: clothes?.image ? "hair-chained" : "hair",
      }),
    );
    if (hair) out.hair = await renderUrl(hair);
    if (out.hair) args.onRender?.("hair", out.hair);
  }

  const beardResult = await beard;
  if (beardResult) out.beard = await renderUrl(beardResult);
  if (out.beard) args.onRender?.("beard", out.beard);
  return out;
}
