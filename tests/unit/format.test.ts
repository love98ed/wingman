import { describe, expect, it } from "vitest";
import { sgd } from "@/lib/utils/format";

describe("sgd", () => {
  it("writes cents only when there are any, and groups thousands", () => {
    expect(sgd(25)).toBe("S$25");
    expect(sgd(1005)).toBe("S$1,005");
    expect(sgd(245.7)).toBe("S$245.70");
    expect(sgd(810.7)).toBe("S$810.70");
    expect(sgd(0.1 + 0.2)).toBe("S$0.30");
  });

  it("rounds to whole dollars on request", () => {
    expect(sgd(2079.6, { whole: true })).toBe("S$2,080");
    expect(sgd(409, { whole: true })).toBe("S$409");
  });
});
