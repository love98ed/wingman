import type { Occasion } from "@/lib/catalog/types";

/** Occasion choices shown on the home page and the style flow, with a starter sentence for each. */
export const OCCASION_CHOICES: { id: Occasion; label: string; cta: string; example: string }[] = [
  { id: "date", label: "First date", cta: "a first date", example: "First date Friday night, rooftop bar, want to look effortless" },
  { id: "interview", label: "Interview", cta: "the interview", example: "Job interview at a bank in the CBD, Monday morning" },
  { id: "wedding", label: "Wedding guest", cta: "the wedding", example: "Friend's wedding dinner at a hotel ballroom, Saturday night" },
  { id: "cny", label: "CNY visiting", cta: "CNY visiting", example: "Visiting relatives on the first day of Chinese New Year" },
  { id: "dnd", label: "Company D&D", cta: "the D&D", example: "Company dinner and dance at a hotel, smart dress code" },
  { id: "night-out", label: "Night out", cta: "a night out", example: "Drinks with friends on Saturday night, then dancing" },
];

export const TIER_LABELS = { budget: "Budget", mid: "Mid-range", luxury: "Luxury" } as const;
