type Crop = { x: number; y: number; width: number; height: number };

/**
 * Browser-side: shrink a photo to at most `longSide` px as a JPEG, upright per its EXIF.
 * Keeps uploads well under Vercel's 4.5 MB request limit; the server only needs 2048px.
 * `crop` (fractions of the upright photo) zooms in first, from the full-resolution pixels.
 */
export async function downscalePhoto(file: File, longSide = 2048, quality = 0.9, crop?: Crop): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const sx = Math.round((crop?.x ?? 0) * bitmap.width);
  const sy = Math.round((crop?.y ?? 0) * bitmap.height);
  const sw = Math.round((crop?.width ?? 1) * bitmap.width);
  const sh = Math.round((crop?.height ?? 1) * bitmap.height);
  const scale = Math.min(1, longSide / Math.max(sw, sh));
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read that photo"))), "image/jpeg", quality),
  );
}
