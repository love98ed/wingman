import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm/client", () => ({ generateStructured: vi.fn() }));
vi.mock("@/lib/agent/memo", () => ({ memo: vi.fn() }));
const { measurePhoto, problemsFrom, zoomFrom } = await import("@/lib/photo/check");

const good = { width: 2000, height: 2500, brightness: 200, sharpness: 180 };
const clear = {
  people: 1,
  face_visible: true,
  face_cut_off: false,
  shoulders_visible: true,
  facing_camera: true,
  face_covered: false,
  face_left: 0.4,
  face_top: 0.1,
  face_width: 0.2,
  face_height: 0.2,
  left_eye_x: 0.46,
  left_eye_y: 0.18,
  right_eye_x: 0.54,
  right_eye_y: 0.18,
};
const codes = (m = good, v: typeof clear | null = clear) => problemsFrom(m, v).map((p) => p.code);

describe("problemsFrom", () => {
  it("passes a clear, waist-up photo", () => {
    expect(codes()).toEqual([]);
  });

  it("names each thing a try-on can't work with", () => {
    expect(codes({ ...good, width: 400 })).toContain("TOO_SMALL");
    expect(codes(good, { ...clear, people: 2 })).toEqual(["MULTIPLE_PEOPLE"]);
    expect(codes(good, { ...clear, people: 0 })).toEqual(["NO_PERSON"]);
    expect(codes(good, { ...clear, face_cut_off: true })).toEqual(["FACE_CUT_OFF"]);
    expect(codes(good, { ...clear, shoulders_visible: false })).toEqual(["SHOULDERS_CUT_OFF"]);
    // Small in a small, close photo: zooming in can't help
    expect(codes({ ...good, width: 520, height: 650 }, { ...clear, face_left: 0.39, face_width: 0.22 })).toEqual(["FACE_TOO_SMALL"]);
  });

  it("only warns about a smallish face that zooming can't enlarge", () => {
    const problems = problemsFrom({ ...good, width: 600, height: 750 }, { ...clear, face_left: 0.375, face_width: 0.25 });
    expect(problems.map((p) => [p.code, p.soft])).toEqual([["FACE_LOW_RES", true]]);
  });

  it("zooms into a person standing too far back instead of rejecting the photo", () => {
    const far = { ...clear, face_left: 0.475, face_top: 0.15, face_width: 0.05, face_height: 0.05 };
    expect(codes(good, far)).toEqual([]);
    const zoom = zoomFrom(good, far)!;
    expect(zoom.width).toBeCloseTo(0.24, 2);
    expect(zoom.x + zoom.width / 2).toBeCloseTo(0.5, 2);
    expect(zoomFrom(good, clear)).toBeNull();
    expect(zoomFrom(good, { ...far, people: 2 })).toBeNull();
    expect(zoomFrom(good, null)).toBeNull();
  });

  it("treats light, blur, angle and a covered face as soft", () => {
    const problems = problemsFrom({ ...good, brightness: 40, sharpness: 40 }, { ...clear, facing_camera: false, face_covered: true });
    expect(problems.map((p) => p.code).sort()).toEqual(["BLURRY", "FACE_COVERED", "NOT_FACING", "TOO_DARK"]);
    expect(problems.every((p) => p.soft)).toBe(true);
    expect(codes({ ...good, brightness: 250 })).toEqual(["TOO_BRIGHT"]);
  });

  it("lists hard problems before soft ones", () => {
    const problems = problemsFrom({ ...good, brightness: 40 }, { ...clear, face_cut_off: true });
    expect(problems.map((p) => p.soft)).toEqual([false, true]);
  });

  it("still checks size, light and blur when the vision check couldn't run", () => {
    expect(codes({ ...good, sharpness: 40 }, null)).toEqual(["BLURRY"]);
  });

  it("gives every problem a message and a tip", () => {
    for (const p of problemsFrom({ width: 100, height: 100, brightness: 10, sharpness: 1 }, { ...clear, people: 3 })) {
      expect(p.message.length).toBeGreaterThan(10);
      expect(p.tip.length).toBeGreaterThan(10);
    }
  });
});

describe("measurePhoto", () => {
  it("tells a sharp, well-lit photo from a dark or blurred copy", async () => {
    const photo = await sharp(await readFile("fixtures/selfies/demo.jpg")).resize(1024).toBuffer();
    const measure = (buf: Buffer) => measurePhoto(buf, 2000, 2500);
    const base = await measure(photo);
    expect(base.brightness).toBeGreaterThan(150);
    expect(base.sharpness).toBeGreaterThan(100);
    const dark = await measure(await sharp(photo).linear(0.2, 0).toBuffer());
    expect(dark.brightness).toBeLessThan(60);
    // Dark is not blurry
    expect(dark.sharpness).toBeGreaterThan(100);
    expect((await measure(await sharp(photo).blur(3).toBuffer())).sharpness).toBeLessThan(65);
  });
});

describe("faceFromFractions", () => {
  it("turns the photo check's face box and eyes into pixels with head tilt", async () => {
    const { faceFromFractions } = await import("@/lib/photo/prepare");
    const face = faceFromFractions(
      { left: 0.4, top: 0.1, width: 0.2, height: 0.25, left_eye_x: 0.45, left_eye_y: 0.2, right_eye_x: 0.55, right_eye_y: 0.2 },
      2000,
      2500,
    );
    expect(face).toEqual({ x: 800, y: 250, width: 400, height: 625, roll: 0 });
  });
});
