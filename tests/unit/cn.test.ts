import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils/cn";

describe("cn", () => {
  it("keeps a type step next to a text colour", () => {
    expect(cn("text-small", "text-background")).toBe("text-small text-background");
    expect(cn("text-lead text-brass")).toBe("text-lead text-brass");
  });

  it("lets a later type step win", () => {
    expect(cn("text-small", "text-lead")).toBe("text-lead");
  });
});
