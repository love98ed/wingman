import { runCompare } from "@/lib/agent/flows/compare";
import { CompareRequestSchema } from "@/lib/agent/schemas";
import { jsonField, photoStreamRoute } from "@/lib/api/stream";

// One Claude match, two try-ons and two Fit Checks.
export const maxDuration = 300;

/** Multipart form: photo and look (JSON: name, tier, items [{slot, id}], hair, occasion). Streams CompareEvent lines for the two other tiers. */
export const POST = photoStreamRoute({
  label: "compare",
  read: jsonField("look"),
  schema: CompareRequestSchema,
  invalid: "Send the look to compare.",
  run: runCompare,
});
