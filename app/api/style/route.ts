import { runStyle } from "@/lib/agent/flows/style";
import { StyleRequestSchema } from "@/lib/agent/schemas";
import { photoStreamRoute } from "@/lib/api/stream";

// Several Claude calls and chained YouCam renders; well over the default limit.
export const maxDuration = 300;

/** Multipart form: photo, occasion (one sentence), tier, optional maxBudget. Streams StyleEvent lines. */
export const POST = photoStreamRoute({
  label: "style",
  read: (form) => ({ occasion: form.get("occasion"), tier: form.get("tier"), maxBudget: form.get("maxBudget") || undefined }),
  schema: StyleRequestSchema,
  invalid: "Tell us the occasion and pick a budget.",
  run: runStyle,
});
