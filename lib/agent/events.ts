/**
 * Shapes the style route streams to the browser, plus a reader for the stream.
 * Safe to import from client components (no server-only code).
 */
import type { Slot } from "./catalog";
import type { ParsedOccasion, PrepPlan } from "./schemas";

export type RenderKind = "outfit" | "hair" | "beard";

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
  renders: { outfit?: string; hair?: string; beard?: string; errors: string[] };
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

/** Progress steps the loading screen shows, in order. */
export const STYLE_STEPS = ["reading", "picking", "rendering", "scoring"] as const;
export type StyleStep = (typeof STYLE_STEPS)[number];

/** Streamed to the client as newline-delimited JSON. */
export type StyleEvent =
  | { type: "progress"; step: StyleStep; detail?: string }
  | { type: "looks"; occasion: ParsedOccasion; looks: Look[] }
  | { type: "render"; look: number; kind: RenderKind; url: string }
  | { type: "fitcheck"; checks: NonNullable<Look["fitCheck"]>[] }
  | { type: "prep"; prepPlan: PrepPlan; skinAnalysed: boolean }
  | { type: "result"; result: StyleResult }
  | { type: "error"; code: string; message: string };

/** Read a newline-delimited JSON stream, calling `onEvent` for each event in order. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: StyleEvent) => void) {
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
      if (line) onEvent(JSON.parse(line) as StyleEvent);
    }
    if (done) return;
  }
}
