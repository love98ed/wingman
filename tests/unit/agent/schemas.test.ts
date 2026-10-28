import { describe, expect, it } from "vitest";
import {
  FitCheckSchema,
  LookPicksSchema,
  ParsedOccasionSchema,
  PrepPlanSchema,
  StyleRequestSchema,
} from "@/lib/agent/schemas";
import { BEARD_STYLES, BEARD_TEMPLATES, HAIR_STYLES, HAIR_TEMPLATES } from "@/lib/agent/grooming";
import hairTemplates from "../../../fixtures/youcam/hair-templates.json";
import beardTemplates from "../../../fixtures/youcam/beard-templates.json";

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

  it("needs 2 to 3 looks", () => {
    expect(LookPicksSchema.safeParse({ looks: [look] }).success).toBe(false);
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

describe("grooming templates", () => {
  it("only offers template ids that exist in YouCam's listings", () => {
    const hairIds = new Set(hairTemplates.map((t) => t.id));
    const beardIds = new Set(beardTemplates.map((t) => t.id));
    for (const style of HAIR_STYLES) expect(hairIds.has(HAIR_TEMPLATES[style])).toBe(true);
    for (const style of BEARD_STYLES) expect(beardIds.has(BEARD_TEMPLATES[style])).toBe(true);
  });
});
