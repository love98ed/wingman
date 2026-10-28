import { describe, expect, it } from "vitest";
import { cropBoxes, rollDegrees, rotatePoint } from "@/lib/photo/crops";

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

describe("head tilt", () => {
  it("measures roll from eye centres", () => {
    expect(rollDegrees({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(0);
    expect(rollDegrees({ x: 0, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(45);
    expect(rollDegrees({ x: 0, y: 10 }, { x: 100, y: 0 })).toBeLessThan(0);
  });

  it("maps a point through a clockwise rotation about the centre", () => {
    // 90° clockwise: the right-middle of a 100x100 image moves to bottom-middle.
    const p = rotatePoint({ x: 100, y: 50 }, 100, 100, 90, 100, 100);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(100);
  });

  it("keeps the centre fixed on an expanded canvas", () => {
    const p = rotatePoint({ x: 50, y: 60 }, 100, 120, 10, 130, 140);
    expect(p).toEqual({ x: 65, y: 70 });
  });
});
