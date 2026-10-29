import { z } from "zod";
import { FORMALITIES, OCCASIONS, TIERS } from "@/lib/catalog/types";

/** Form fields posted to /api/style (the photo arrives as a separate file field). */
export const StyleRequestSchema = z.object({
  occasion: z.string().trim().min(3).max(300),
  tier: z.enum(TIERS),
  maxBudget: z.coerce.number().positive().max(20000).optional(),
});
export type StyleRequest = z.infer<typeof StyleRequestSchema>;

/** CLAUDE.md section 6 step 1. budgetTier and maxBudget come from the request, not the model. */
export const ParsedOccasionSchema = z.object({
  occasion: z.enum(OCCASIONS),
  formality: z.enum(FORMALITIES),
  setting: z.string(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night", "any"]),
  constraints: z.array(z.string()).max(6),
});
export type ParsedOccasion = z.infer<typeof ParsedOccasionSchema> & {
  budgetTier: StyleRequest["tier"];
  maxBudget?: number;
};

/** One look as Claude picks it: product ids from the candidate list, grooming by template title. */
export const LookPickSchema = z.object({
  name: z.string(),
  top: z.string(),
  outerwear: z.string().nullable(),
  bottom: z.string(),
  shoes: z.string(),
  watch: z.string().nullable(),
  hair: z.string().nullable(),
  beard: z.string().nullable(),
  why: z.string(),
});
export type LookPick = z.infer<typeof LookPickSchema>;

export const LookPicksSchema = z.object({ looks: z.array(LookPickSchema).min(2).max(3) });

/** The same look rebuilt at another tier: one product id per slot the look fills. */
export const TierPickSchema = z.object({
  tier: z.enum(TIERS),
  top: z.string().nullable(),
  outerwear: z.string().nullable(),
  bottom: z.string().nullable(),
  shoes: z.string().nullable(),
  watch: z.string().nullable(),
  /** One short sentence on what changes at this price (fabric, make, details). */
  note: z.string(),
});
export type TierPick = z.infer<typeof TierPickSchema>;

export const TierPicksSchema = z.object({ versions: z.array(TierPickSchema).min(1).max(2) });

/** JSON field `look` posted to /api/compare beside the photo. */
export const CompareRequestSchema = z.object({
  name: z.string().max(80),
  tier: z.enum(TIERS),
  items: z
    .array(z.object({ slot: z.enum(["top", "outerwear", "bottom", "shoes", "watch"]), id: z.string().max(200) }))
    .min(1)
    .max(5),
  hair: z.string().nullable(),
  occasion: ParsedOccasionSchema,
});
export type CompareRequest = z.infer<typeof CompareRequestSchema>;

export const FitCheckSchema = z.object({
  checks: z.array(z.object({ score: z.number().min(0).max(10), reasoning: z.string() })),
});

export const PrepPlanSchema = z.object({
  steps: z.array(z.object({ title: z.string(), detail: z.string() })).length(3),
});
export type PrepPlan = z.infer<typeof PrepPlanSchema>;
