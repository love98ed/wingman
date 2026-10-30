import "server-only";

import sharp from "sharp";
import { z } from "zod";
import { cached, memo } from "@/lib/agent/memo";
import { generateStructured } from "@/lib/llm/client";
import { zoomBox, type Box } from "./crops";
import { faceFromFractions, normalisePhoto, type Face } from "./prepare";
import { photoProblem, type PhotoCheck, type PhotoProblem } from "./problems";

/**
 * Edge strength relative to the photo's own contrast, measured on the test photos at 1024px:
 * sharp ones 160 to 250 (dark or bright), a slight blur 100 to 140, a clear blur 33 to 61.
 */
const BLUR_BELOW = 65;
/** Mean grey level 0 to 255: well-lit photos sit near 200, a dim room near 70. */
const DARK_BELOW = 60;
const BRIGHT_ABOVE = 245;
/** Same limits preparePhoto enforces before any render. */
const MIN_SIDE = 512;
const MIN_FACE_PX = 200;

export type PhotoMetrics = { width: number; height: number; brightness: number; sharpness: number };

const VisionSchema = z.object({
  /** People in the foreground, as close to the camera as the main person. Passers-by behind don't count. */
  people: z.number().int().min(0),
  face_visible: z.boolean(),
  /** The face itself (forehead, chin, a cheek) cut off by the photo's edge. Cropped hair or ears are fine. */
  face_cut_off: z.boolean(),
  shoulders_visible: z.boolean(),
  facing_camera: z.boolean(),
  /** A hand, mask, hat brim or hair hides a large part of the face. Glasses never count. */
  face_covered: z.boolean(),
  /** Face box (hairline to chin, ear to ear) as fractions of the photo's width and height. */
  face_left: z.number().min(0).max(1),
  face_top: z.number().min(0).max(1),
  face_width: z.number().min(0).max(1),
  face_height: z.number().min(0).max(1),
  /** Pupil centres as fractions; "left" is the eye on the left of the image. Lets styling skip its own face call. */
  left_eye_x: z.number().min(0).max(1),
  left_eye_y: z.number().min(0).max(1),
  right_eye_x: z.number().min(0).max(1),
  right_eye_y: z.number().min(0).max(1),
});
export type PhotoVision = z.infer<typeof VisionSchema>;

/** Brightness, and sharpness as Laplacian spread over grey spread (x1000), on a 1024px greyscale copy. */
export async function measurePhoto(normalised: Buffer, width: number, height: number): Promise<PhotoMetrics> {
  const grey = await sharp(normalised).resize(1024, 1024, { fit: "inside" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  // stats() reads its input, so measure rendered buffers rather than a pipeline
  const { mean: brightness, stdev: contrast } = (await sharp(grey.data, { raw: grey.info }).stats()).channels[0];
  const edges = await sharp(grey.data, { raw: grey.info })
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Relative to contrast, so a dark but sharp photo isn't mistaken for a blurry one
  const sharpness = ((await sharp(edges.data, { raw: edges.info }).stats()).channels[0].stdev / Math.max(contrast, 1)) * 1000;
  return { width, height, brightness, sharpness };
}

/** Where to crop a photo taken from too far away, as fractions of its size; null when it's close enough. */
export function zoomFrom(metrics: PhotoMetrics, vision: PhotoVision | null): Box | null {
  if (!vision || vision.people !== 1 || !vision.face_visible || vision.face_cut_off) return null;
  const { width, height } = metrics;
  const face = { x: vision.face_left * width, y: vision.face_top * height, width: vision.face_width * width, height: vision.face_height * height };
  const box = zoomBox(face, width, height, MIN_FACE_PX);
  return box && { x: box.x / width, y: box.y / height, width: box.width / width, height: box.height / height };
}

/** Problems found, hard ones first. `vision` is null when the Claude check couldn't run. */
export function problemsFrom(metrics: PhotoMetrics, vision: PhotoVision | null): PhotoProblem[] {
  const codes: Parameters<typeof photoProblem>[0][] = [];
  if (Math.min(metrics.width, metrics.height) < MIN_SIDE) codes.push("TOO_SMALL");
  if (vision) {
    if (vision.people > 1) codes.push("MULTIPLE_PEOPLE");
    else if (vision.people === 0 || !vision.face_visible) codes.push("NO_PERSON");
    else {
      if (vision.face_cut_off) codes.push("FACE_CUT_OFF");
      if (!vision.shoulders_visible) codes.push("SHOULDERS_CUT_OFF");
      // A photo the browser can zoom into is checked again once zoomed
      if (vision.face_width * metrics.width < MIN_FACE_PX && !zoomFrom(metrics, vision)) codes.push("FACE_TOO_SMALL");
      if (vision.face_covered) codes.push("FACE_COVERED");
      if (!vision.facing_camera) codes.push("NOT_FACING");
    }
  }
  if (metrics.brightness < DARK_BELOW) codes.push("TOO_DARK");
  else if (metrics.brightness > BRIGHT_ABOVE) codes.push("TOO_BRIGHT");
  if (metrics.sharpness < BLUR_BELOW) codes.push("BLURRY");
  return codes.map(photoProblem).sort((a, b) => Number(a.soft) - Number(b.soft));
}

/** Cache key of a photo's vision check, by the hash of the normalised photo. */
const checkKey = (hash: string) => ({ selfieHash: hash, api: "photo-check", params: { v: 4 } });

/**
 * The face box from this photo's earlier check, in pixels of the normalised photo, so styling
 * doesn't ask Claude again. Null when the photo wasn't checked or the check saw no single face.
 */
export async function checkedFace(hash: string, width: number, height: number): Promise<Face | null> {
  const v = await cached<PhotoVision>(checkKey(hash)).catch(() => null);
  if (!v || v.people !== 1 || !v.face_visible) return null;
  const { face_left: left, face_top: top, face_width, face_height } = v;
  return faceFromFractions({ ...v, left, top, width: face_width, height: face_height }, width, height);
}

async function lookAtPhoto(normalised: Buffer): Promise<PhotoVision> {
  const preview = await sharp(normalised).resize(1568, 1568, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  return generateStructured({
    task: "agent",
    label: "photo-check",
    effort: "low",
    schema: VisionSchema,
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: preview.toString("base64") } },
      {
        type: "text",
        text:
          "This photo is for a virtual clothes try-on: one person, waist up, facing the camera. Report what you see. " +
          "The main person is the largest one nearest the camera; every other field is about them. people counts the " +
          "people in the foreground, about as close to the camera as the main person; people further back, smaller or " +
          "out of focus, don't count. face_cut_off is true only when the photo's edge cuts through the main person's " +
          "face (forehead, chin or a cheek); cropped hair or ears are fine. shoulders_visible is true when both shoulders and the upper chest are " +
          "in the photo. facing_camera is false only when the head or body is clearly turned (profile, three-quarter " +
          "or more). face_covered is true only when a hand, mask, hat brim or hair hides a large part of the face; " +
          "glasses and sunglasses never count. face_left, face_top, face_width and face_height are the face box, hairline " +
          "to chin and ear to ear, as fractions (0 to 1) of the photo's width and height from the top-left corner. " +
          "left_eye and right_eye are the centre of each pupil as fractions; left_eye is the eye on the left side of the image.",
      },
    ],
  });
}

/** Check an uploaded photo before styling. Cached per photo; a failed Claude call never blocks. */
export async function checkPhoto(input: Buffer): Promise<PhotoCheck> {
  const { normalised, width, height, hash } = await normalisePhoto(input);
  const [metrics, vision] = await Promise.all([
    measurePhoto(normalised, width, height),
    memo(checkKey(hash), () => lookAtPhoto(normalised)).catch((err: Error) => {
      console.warn(`[photo-check] vision skipped: ${err.message}`);
      return null;
    }),
  ]);
  const problems = problemsFrom(metrics, vision);
  return { ok: problems.every((p) => p.soft), problems, zoom: zoomFrom(metrics, vision) ?? undefined };
}
