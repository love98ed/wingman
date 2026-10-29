import { describe, expect, it, vi } from "vitest";
import { RefinedOccasionSchema } from "@/lib/agent/schemas";

vi.mock("@/lib/llm/client", () => ({ generateStructured: vi.fn() }));
const { tidyReply } = await import("@/lib/agent/steps");

describe("tidyReply", () => {
  it("strips JSON leftovers from the end of a reply", () => {
    expect(tidyReply("Done, lighter trousers are in each look's list.}")).toBe("Done, lighter trousers are in each look's list.");
    expect(tidyReply('Try "shoes under S$150".\u201D}')).toBe('Try "shoes under S$150".');
  });

  it("keeps a reply that ends with a properly closed quote", () => {
    expect(tidyReply('Try something like "make it dressier"')).toBe('Try something like "make it dressier"');
    expect(tidyReply("I've capped each look at S$300.")).toBe("I've capped each look at S$300.");
  });
});

describe("RefinedOccasionSchema", () => {
  const base = { formality: "casual", setting: "rooftop bar", constraints: [], maxBudget: null, reply: "Done." };

  it("needs a verdict of apply or reject, and a reply", () => {
    expect(RefinedOccasionSchema.safeParse({ ...base, verdict: "apply" }).success).toBe(true);
    expect(RefinedOccasionSchema.safeParse({ ...base, verdict: "reject" }).success).toBe(true);
    expect(RefinedOccasionSchema.safeParse({ ...base, verdict: "maybe" }).success).toBe(false);
    expect(RefinedOccasionSchema.safeParse({ ...base, verdict: "apply", reply: undefined }).success).toBe(false);
  });
});
