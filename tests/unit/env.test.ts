import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

const base = {
  YOUCAM_API_KEY: "yc",
  ANTHROPIC_API_KEY: "sk",
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
};

describe("parseServerEnv", () => {
  it("applies defaults", () => {
    const env = parseServerEnv(base);
    expect(env.MOCK_YOUCAM).toBe(false);
    expect(env.YOUCAM_UNIT_LIMIT).toBe(700);
  });

  it("parses flags, limit and store list", () => {
    const env = parseServerEnv({
      ...base,
      MOCK_YOUCAM: "true",
      YOUCAM_UNIT_LIMIT: "500",
    });
    expect(env.MOCK_YOUCAM).toBe(true);
    expect(env.YOUCAM_UNIT_LIMIT).toBe(500);
  });

  it("names missing keys without leaking values", () => {
    expect(() => parseServerEnv({ ...base, ANTHROPIC_API_KEY: "" })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });

  it("rejects a bad unit limit", () => {
    expect(() => parseServerEnv({ ...base, YOUCAM_UNIT_LIMIT: "-1" })).toThrow();
  });
});
