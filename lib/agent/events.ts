/**
 * Shapes the style route streams to the browser, plus a reader for the stream.
 * Safe to import from client components (no server-only code).
 */
import type { Slot } from "@/lib/agent/slots";
import type { Tier } from "@/lib/catalog/types";
import type { ParsedOccasion, PrepPlan } from "./schemas";

export type RenderKind = "outfit" | "hair" | "beard";

export type LookItem = {
  slot: Slot;
  id: string;
  name: string;
  store: string;
  storeName: string;
  price: number;
  colour: string;
  image: string;
  url: string;
  /** In-stock sizes only. */
  sizes: { variantId: number; size: string }[];
};

export type Look = {
  name: string;
  /** Price tier the pieces come from; changes when the user picks another version in Price Compare. */
  tier: Tier;
  why: string;
  items: LookItem[];
  hair: string | null;
  beard: string | null;
  renders: {
    outfit?: string;
    hair?: string;
    beard?: string;
    errors: string[];
    /** Images that failed this run, with the error code; cleared when one is tried again. */
    failed?: Partial<Record<RenderKind, string>>;
  };
  /** Null until the Fit Check has run. */
  fitCheck: { score: number; reasoning: string } | null;
  total: number;
};

export type StyleResult = {
  occasion: ParsedOccasion;
  looks: Look[];
  prepPlan: PrepPlan;
  /** False when skin analysis failed (e.g. glasses, angle); the prep plan is then general. */
  skinAnalysed: boolean;
};

/** Whether a piece is drawn in the try-on: only the outer layer is (jacket if there is one, else the top). */
export const showsInRender = (look: Look, slot: LookItem["slot"]) =>
  slot === (look.items.some((i) => i.slot === "outerwear") ? "outerwear" : "top");

/** Progress steps the loading screen shows, in order. */
export const STYLE_STEPS = ["reading", "picking", "rendering", "scoring"] as const;
export type StyleStep = (typeof STYLE_STEPS)[number];

/** Streamed to the client as newline-delimited JSON. */
export type StyleEvent =
  | { type: "progress"; step: StyleStep; detail?: string }
  | { type: "looks"; occasion: ParsedOccasion; looks: Look[] }
  | { type: "render"; look: number; kind: RenderKind; url: string }
  /** One try-on image failed; the look is still shown, with a retry on the loading screen. */
  | { type: "renderFailed"; look: number; kind: RenderKind; code: string }
  | { type: "fitcheck"; checks: NonNullable<Look["fitCheck"]>[] }
  /** A refine was accepted: what Wingman is changing, in a sentence for the user. */
  | { type: "refined"; reply: string }
  /** Looks that scored too low are dropped after the Fit Check: keep these indexes, in order. */
  | { type: "prune"; keep: number[]; dropped: number }
  | { type: "prep"; prepPlan: PrepPlan; skinAnalysed: boolean }
  /** Every image has landed or failed and the looks are scored: the looks screen can open. */
  | { type: "ready" }
  | { type: "result"; result: StyleResult }
  | { type: "error"; code: string; message: string };

/** The same look at another tier, as Price Compare shows it. */
export type TierVersion = {
  tier: Tier;
  items: LookItem[];
  total: number;
  /** What changes at this price, one sentence. */
  note: string;
  /** Why the look works; set on the version a look had before the user switched tier. */
  why?: string;
  renders: { outfit?: string; hair?: string; errors: string[] };
  fitCheck: Look["fitCheck"];
};

/** Streamed by /api/compare, one JSON object per line. */
export type CompareEvent =
  | { type: "versions"; versions: TierVersion[] }
  | { type: "render"; tier: Tier; kind: Exclude<RenderKind, "beard">; url: string }
  | { type: "fitcheck"; tier: Tier; check: NonNullable<Look["fitCheck"]> }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

/** A piece in Browse: a look item plus its tier. */
export type BrowseItem = LookItem & { tier: Tier };

/** GET /api/browse response. */
export type BrowsePage = {
  items: BrowseItem[];
  total: number;
  facets: {
    colours: { value: string; count: number }[];
    sizes: { value: string; count: number }[];
    stores: { value: string; label: string; count: number }[];
  };
};

/** Streamed by /api/swap after a piece is swapped: the new try-on and score. */
export type SwapEvent =
  | { type: "render"; kind: RenderKind; url: string }
  | { type: "renderFailed"; kind: RenderKind; code: string }
  | { type: "fitcheck"; check: NonNullable<Look["fitCheck"]> }
  | { type: "done" }
  | { type: "error"; code: string; message: string };

/** Read a newline-delimited JSON stream, calling `onEvent` for each event in order. */
export async function readEvents<E = StyleEvent>(body: ReadableStream<Uint8Array>, onEvent: (event: E) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as E);
    }
    if (done) return;
  }
}
