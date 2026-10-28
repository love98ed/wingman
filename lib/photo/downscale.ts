/**
 * Browser-side: shrink a photo to at most `longSide` px as a JPEG, upright per its EXIF.
 * Keeps uploads well under Vercel's 4.5 MB request limit; the server only needs 2048px.
 */
export async function downscalePhoto(file: File, longSide = 2048, quality = 0.9): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read that photo"))), "image/jpeg", quality),
  );
}
