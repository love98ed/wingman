import { describe, expect, it } from "vitest";
import { cropBoxes } from "@/lib/photo/crops";

describe("cropBoxes", () => {
  it("keeps crop boxes inside the image with the face centred", () => {
    const { hair, face } = cropBoxes({ x: 1300, y: 500, width: 400, height: 520 }, 3000, 4000);
    for (const b of [hair, face]) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(3000);
      expect(b.y + b.height).toBeLessThanOrEqual(4000);
    }
    expect(face.x + face.width / 2).toBeCloseTo(1500, 0);
    expect(face.width).toBe(600);
  });

  it("shifts a crop at the image edge instead of overflowing", () => {
    const { hair } = cropBoxes({ x: 0, y: 0, width: 400, height: 500 }, 1000, 1500);
    expect(hair).toMatchObject({ x: 0, y: 0, width: 1000 });
  });
});
