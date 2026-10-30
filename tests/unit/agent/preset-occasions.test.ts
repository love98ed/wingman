import { describe, expect, it } from "vitest";
import { PRESET_OCCASIONS } from "@/lib/agent/preset-occasions";
import { ParsedOccasionSchema } from "@/lib/agent/schemas";
import { OCCASION_CHOICES } from "@/lib/occasions";

describe("PRESET_OCCASIONS", () => {
  it("has a valid parse, of the right occasion, for every chip sentence", () => {
    for (const choice of OCCASION_CHOICES) {
      const parsed = PRESET_OCCASIONS[choice.example];
      expect(ParsedOccasionSchema.parse(parsed).occasion).toBe(choice.id);
    }
  });

  it("only matches the chip sentences exactly, so an edited one goes to Claude", () => {
    expect(PRESET_OCCASIONS[`${OCCASION_CHOICES[0].example}, no black`]).toBeUndefined();
  });
});
