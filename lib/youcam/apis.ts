/**
 * Endpoints and unit costs from the YouCam API reference (docs.perfectcorp.com,
 * read 2026-10-28). Do not change without re-checking the docs.
 */
export const YOUCAM_APIS = {
  // AI Clothes Virtual Try-On v3, garment_category "auto". 2 units.
  clothes: { path: "/s2s/v2.0/task/cloth-v3", units: 2, output: "image" },
  // AI Hairstyle Generator, preset template mode. 1 unit (v2.1 transfer costs 2).
  hair: { path: "/s2s/v2.0/task/hair-style", units: 1, output: "image" },
  // AI Beard Style Generator. 2 units.
  beard: { path: "/s2s/v2.0/task/beard-style", units: 2, output: "image" },
  // AI Skin Analysis, SD concerns only. Units depend on concern count (see skinUnits).
  skin: { path: "/s2s/v2.0/task/skin-analysis", units: 9, output: "json" },
} as const;

export type YouCamApi = keyof typeof YOUCAM_APIS;

export const TEMPLATE_PATHS = {
  hair: "/s2s/v2.0/task/template/hair-style",
  beard: "/s2s/v2.0/task/template/beard-style",
} as const;

/** SD concern names from the skin analysis reference. Never mix with hd_* concerns. */
export const SD_CONCERNS = [
  "acne",
  "age_spot",
  "dark_circle_v2",
  "eye_bag",
  "firmness",
  "moisture",
  "oiliness",
  "pore",
  "radiance",
  "redness",
  "texture",
  "wrinkle",
] as const;
export type SdConcern = (typeof SD_CONCERNS)[number];

/** Grooming-relevant default: 4 concerns = 9 units. */
export const DEFAULT_SKIN_CONCERNS: SdConcern[] = ["oiliness", "redness", "texture", "dark_circle_v2"];

export function skinUnits(concernCount: number): number {
  if (concernCount <= 0) throw new Error("At least one skin concern is required");
  if (concernCount <= 4) return 9;
  if (concernCount <= 8) return 12;
  if (concernCount <= 12) return 14;
  return 16;
}

/** Find the result image URL in a poll response's `results` (shape varies by API). */
export function findResultUrl(results: unknown): string | null {
  if (!results || typeof results !== "object") return null;
  if (Array.isArray(results)) {
    for (const item of results) {
      const url = findResultUrl(item);
      if (url) return url;
    }
    return null;
  }
  const record = results as Record<string, unknown>;
  if (typeof record.url === "string") return record.url;
  for (const value of Object.values(record)) {
    const url = findResultUrl(value);
    if (url) return url;
  }
  return null;
}
