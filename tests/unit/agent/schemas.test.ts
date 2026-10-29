import { describe, expect, it } from "vitest";
import { BEARD_STYLES, BEARD_TEMPLATES, HAIR_STYLES, HAIR_TEMPLATES } from "@/lib/agent/grooming";
import {
  FitCheckSchema,
  LookPicksSchema,
  ParsedOccasionSchema,
  PrepPlanSchema,
  StyleRequestSchema,
  CompareRequestSchema,
  RefinedOccasionSchema,
  RefineRequestSchema,
  SwapOptionsRequestSchema,
  TierPicksSchema,
} from "@/lib/agent/schemas";
import beardTemplates from "../../../fixtures/youcam/beard-templates.json";
import hairTemplates from "../../../fixtures/youcam/hair-templates.json";

const look = {
  name: "Rooftop easy",
  top: "a",
  outerwear: null,
  bottom: "b",
  shoes: "c",
  watch: null,
  hair: null,
  beard: null,
  why: "Works.",
};

describe("StyleRequestSchema", () => {
  it("accepts form strings and coerces maxBudget", () => {
    const parsed = StyleRequestSchema.parse({ occasion: " First date, rooftop bar ", tier: "mid", maxBudget: "400" });
    expect(parsed).toEqual({ occasion: "First date, rooftop bar", tier: "mid", maxBudget: 400 });
  });

  it("rejects an unknown tier, an empty occasion and a non-positive budget", () => {
    expect(StyleRequestSchema.safeParse({ occasion: "Date", tier: "cheap" }).success).toBe(false);
    expect(StyleRequestSchema.safeParse({ occasion: "  ", tier: "mid" }).success).toBe(false);
    expect(StyleRequestSchema.safeParse({ occasion: "Date night", tier: "mid", maxBudget: "0" }).success).toBe(false);
  });
});

describe("LLM output schemas", () => {
  it("parses an occasion and rejects one outside the list", () => {
    const ok = { occasion: "date", formality: "smart-casual", setting: "rooftop bar", timeOfDay: "night", constraints: [] };
    expect(ParsedOccasionSchema.parse(ok)).toEqual(ok);
    expect(ParsedOccasionSchema.safeParse({ ...ok, occasion: "funeral" }).success).toBe(false);
  });

  it("takes 1 to 3 looks, so Claude never pads with a weak one", () => {
    expect(LookPicksSchema.safeParse({ looks: [] }).success).toBe(false);
    expect(LookPicksSchema.safeParse({ looks: [look] }).success).toBe(true);
    expect(LookPicksSchema.safeParse({ looks: [look, look] }).success).toBe(true);
    expect(LookPicksSchema.safeParse({ looks: [look, look, look, look] }).success).toBe(false);
  });

  it("keeps Fit Check scores within 0 to 10", () => {
    expect(FitCheckSchema.safeParse({ checks: [{ score: 8.6, reasoning: "Good." }] }).success).toBe(true);
    expect(FitCheckSchema.safeParse({ checks: [{ score: 11, reasoning: "Too good." }] }).success).toBe(false);
  });

  it("needs exactly three prep steps", () => {
    const step = { title: "Rest", detail: "Sleep early." };
    expect(PrepPlanSchema.safeParse({ steps: [step, step, step] }).success).toBe(true);
    expect(PrepPlanSchema.safeParse({ steps: [step, step] }).success).toBe(false);
  });
});

describe("Price Compare schemas", () => {
  const occasion = { occasion: "date", formality: "smart-casual", setting: "rooftop bar", timeOfDay: "night", constraints: [] };
  const request = { name: "Rooftop easy", tier: "mid", items: [{ slot: "top", id: "a" }], hair: null, occasion };

  it("accepts a look and rejects an unknown slot or an empty look", () => {
    expect(CompareRequestSchema.safeParse(request).success).toBe(true);
    expect(CompareRequestSchema.safeParse({ ...request, items: [{ slot: "hat", id: "a" }] }).success).toBe(false);
    expect(CompareRequestSchema.safeParse({ ...request, items: [] }).success).toBe(false);
  });

  it("takes one or two tier versions", () => {
    const version = { tier: "budget", top: "a", outerwear: null, bottom: "b", shoes: "c", watch: null, note: "Cheaper." };
    expect(TierPicksSchema.safeParse({ versions: [version, { ...version, tier: "luxury" }] }).success).toBe(true);
    expect(TierPicksSchema.safeParse({ versions: [] }).success).toBe(false);
    expect(TierPicksSchema.safeParse({ versions: [{ ...version, tier: "cheap" }] }).success).toBe(false);
  });
});

describe("Refine and swap schemas", () => {
  const occasion = { occasion: "date", formality: "smart-casual", setting: "rooftop bar", timeOfDay: "night", constraints: [] };
  const refine = {
    message: "more casual",
    sentence: "First date Friday night, rooftop bar",
    tier: "mid",
    occasion: { ...occasion, maxBudget: null },
    previous: [{ name: "Rooftop easy", items: ["Linen shirt", "Chinos"], total: 410 }],
  };

  it("accepts a refine request, trims it and rejects an empty one", () => {
    expect(RefineRequestSchema.parse({ ...refine, message: "  no white sneakers " }).message).toBe("no white sneakers");
    expect(RefineRequestSchema.safeParse({ ...refine, message: " " }).success).toBe(false);
  });

  it("takes a budget cap or null from Claude, never a negative one", () => {
    const brief = { formality: "casual", setting: "rooftop bar", constraints: ["no white sneakers"], verdict: "apply", reply: "Done." };
    expect(RefinedOccasionSchema.safeParse({ ...brief, maxBudget: 300 }).success).toBe(true);
    expect(RefinedOccasionSchema.safeParse({ ...brief, maxBudget: null }).success).toBe(true);
    expect(RefinedOccasionSchema.safeParse({ ...brief, maxBudget: -5 }).success).toBe(false);
  });

  it("needs a known slot to swap", () => {
    const look = { name: "Rooftop easy", tier: "mid", items: [{ slot: "shoes", id: "a" }], hair: null, occasion };
    expect(SwapOptionsRequestSchema.safeParse({ ...look, slot: "shoes" }).success).toBe(true);
    expect(SwapOptionsRequestSchema.safeParse({ ...look, slot: "hat" }).success).toBe(false);
  });
});

describe("grooming templates", () => {
  it("only offers template ids that exist in YouCam's listings", () => {
    const hairIds = new Set(hairTemplates.map((t) => t.id));
    const beardIds = new Set(beardTemplates.map((t) => t.id));
    for (const style of HAIR_STYLES) expect(hairIds.has(HAIR_TEMPLATES[style])).toBe(true);
    for (const style of BEARD_STYLES) expect(beardIds.has(BEARD_TEMPLATES[style])).toBe(true);
  });
});
