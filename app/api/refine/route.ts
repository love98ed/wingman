import { runRefine } from "@/lib/agent/flows/style";
import { RefineRequestSchema } from "@/lib/agent/schemas";
import { jsonField, photoStreamRoute } from "@/lib/api/stream";

// A Claude brief update, a new selection, renders and Fit Checks.
export const maxDuration = 300;

/** Multipart form: photo and refine (JSON: message, sentence, tier, occasion, previous looks). Streams StyleEvent lines, without the prep plan. */
export const POST = photoStreamRoute({
  label: "refine",
  read: jsonField("refine"),
  schema: RefineRequestSchema,
  invalid: "Tell Wingman what to change.",
  run: runRefine,
});
