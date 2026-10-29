import { runSwap } from "@/lib/agent/flows/swap";
import { SwapRequestSchema } from "@/lib/agent/schemas";
import { jsonField, photoStreamRoute } from "@/lib/api/stream";

// One try-on (plus hair when the look has it) and a Fit Check.
export const maxDuration = 300;

/** Multipart form: photo and look (JSON: the look with the new piece in place). Streams SwapEvent lines. */
export const POST = photoStreamRoute({
  label: "swap",
  read: jsonField("look"),
  schema: SwapRequestSchema,
  invalid: "Send the look with the new piece.",
  run: runSwap,
});
