import "server-only";

import sharp from "sharp";
import { z } from "zod";
import { generateStructured } from "@/lib/llm/client";
import { sha256 } from "./cache";
import { cropBoxes, type Box } from "./crops";
import { YouCamError } from "./errors";

/** One user photo, prepared into the framings each YouCam API needs. */
export type PreparedPhoto = {
  /** sha256 of the normalised photo; used in every render cache key. */
  hash: string;
  face: Box;
  /** Size of the normalised original, the coordinate space of `face`. */
  size: { width: number; height: number };
  /** Whole photo, long side <= 2048: clothes try-on. */
  full: Buffer;
  /** Head and shoulders, long side <= 1024: hair try-on. */
  headShoulders: Buffer;
  /** Close face, long side <= 1000: beard try-on and skin analysis. */
  closeFace: Buffer;
};

const FaceBoxSchema = z.object({
  face_found: z.boolean(),
  shoulders_visible: z.boolean(),
  /** Face box (forehead to chin, ear to ear) as fractions of image width/height. */
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
});

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** Ask Claude for the face box. Returns pixels in the image's coordinate space. */
export async function locateFace(jpeg: Buffer, width: number, height: number): Promise<Box> {
  // Claude sees images best at <= 1568px on the long side.
  const preview = await sharp(jpeg).resize(1568, 1568, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  const result = await generateStructured({
    task: "agent",
    label: "face-box",
    effort: "low",
    schema: FaceBoxSchema,
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: preview.toString("base64") } },
      {
        type: "text",
        text:
          "Locate the single person's face in this photo. Return the tight face box from hairline to chin " +
          "and ear to ear as fractions (0 to 1) of image width and height, measured from the top-left corner. " +
          "Set face_found false if there is no clear front-facing face or more than one person.",
      },
    ],
  });
  if (!result.face_found) {
    throw new YouCamError("NO_FACE", "No clear front-facing face found in the photo");
  }
  return {
    x: Math.round(clamp01(result.left) * width),
    y: Math.round(clamp01(result.top) * height),
    width: Math.round(clamp01(result.width) * width),
    height: Math.round(clamp01(result.height) * height),
  };
}

async function cropTo(image: Buffer, box: Box, longSide: number, enlarge = false): Promise<Buffer> {
  return sharp(image)
    .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
    .resize(longSide, longSide, { fit: "inside", withoutEnlargement: !enlarge })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** Crop head-and-shoulders from a render of the photo (e.g. a clothes try-on), which may be resized. */
export async function headShouldersFrom(image: Buffer, photo: PreparedPhoto): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  const sx = width / photo.size.width;
  const sy = height / photo.size.height;
  const face = {
    x: photo.face.x * sx,
    y: photo.face.y * sy,
    width: photo.face.width * sx,
    height: photo.face.height * sy,
  };
  return cropTo(image, cropBoxes(face, width, height).hair, 1024);
}

/** Smallest face width (px) in the original photo that still gives usable face crops. */
const MIN_FACE_PX = 200;

export async function preparePhoto(input: Buffer, knownFace?: Box): Promise<PreparedPhoto> {
  // Apply EXIF rotation and strip metadata (location etc.) before anything leaves the server.
  // Keep up to 4096px (YouCam's max) so face crops come from full-resolution pixels.
  const normalised = await sharp(input)
    .rotate()
    .resize(4096, 4096, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
  const { width = 0, height = 0 } = await sharp(normalised).metadata();
  if (Math.min(width, height) < 512) {
    throw new YouCamError("NO_FACE", "Photo is too small. Use a photo at least 512px wide.");
  }

  const face = knownFace ?? (await locateFace(normalised, width, height));
  if (face.width < MIN_FACE_PX) {
    throw new YouCamError("NO_FACE", "Face is too small in the photo. Move closer to the camera.");
  }
  const boxes = cropBoxes(face, width, height);

  return {
    hash: sha256(normalised),
    face,
    size: { width, height },
    full: await sharp(normalised).resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer(),
    headShoulders: await cropTo(normalised, boxes.hair, 1024),
    // Always 1000px long side (4:5 → 800px short side): beard needs < 1024 with face > 256px,
    // skin analysis needs short side >= 480 with the face at 60-80% of the width.
    closeFace: await cropTo(normalised, boxes.face, 1000, true),
  };
}
