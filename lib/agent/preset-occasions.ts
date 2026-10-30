import type { ParsedOccasion } from "@/lib/agent/schemas";
import type { Occasion } from "@/lib/catalog/types";
import { OCCASION_CHOICES } from "@/lib/occasions";

type Parsed = Omit<ParsedOccasion, "budgetTier" | "maxBudget">;

/**
 * parseOccasion's answer (Sonnet, 30 Oct 2026) for each occasion chip's sentence, so a run
 * started from a chip skips that Claude call. Keyed by occasion; edited sentences still go to Claude.
 */
const PARSED: Record<Occasion, Parsed> = {
  date: {
    occasion: "date",
    formality: "smart-casual",
    setting: "rooftop bar",
    timeOfDay: "night",
    constraints: ["look effortless", "first date"],
  },
  interview: {
    occasion: "interview",
    formality: "formal",
    setting: "Bank office in the CBD, Singapore",
    timeOfDay: "morning",
    constraints: [],
  },
  wedding: {
    occasion: "wedding",
    formality: "formal",
    setting: "hotel ballroom wedding dinner",
    timeOfDay: "night",
    constraints: [],
  },
  cny: {
    occasion: "cny",
    formality: "smart-casual",
    setting: "Relatives' homes for first day Chinese New Year visiting",
    timeOfDay: "any",
    constraints: [],
  },
  dnd: {
    occasion: "dnd",
    formality: "smart-casual",
    setting: "hotel ballroom company dinner and dance in Singapore",
    timeOfDay: "evening",
    constraints: ["smart dress code"],
  },
  "night-out": {
    occasion: "night-out",
    formality: "smart-casual",
    setting: "Drinks at a bar followed by dancing at a club in Singapore",
    timeOfDay: "night",
    constraints: [],
  },
};

/** Each chip's example sentence to its parsed occasion. */
export const PRESET_OCCASIONS: Record<string, Parsed> = Object.fromEntries(
  OCCASION_CHOICES.map((o) => [o.example, PARSED[o.id]]),
);
