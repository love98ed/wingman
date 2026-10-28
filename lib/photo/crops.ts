export type Box = { x: number; y: number; width: number; height: number };

/**
 * Crop boxes around a face for each YouCam API's framing rules:
 * - hair: head and shoulders (hair VTO errors without shoulders), 4:5
 * - face: face fills ~2/3 of the width (skin analysis wants 60-80%; beard needs
 *   face > 256px after resizing to < 1024px), 4:5
 * Boxes are clamped to the image and shifted rather than shrunk where possible.
 */
export function cropBoxes(face: Box, imageWidth: number, imageHeight: number) {
  const cx = face.x + face.width / 2;
  const cy = face.y + face.height / 2;

  const hairWidth = face.width * 3.2;
  const hair = fitBox(
    { x: cx - hairWidth / 2, y: face.y - face.height * 0.7, width: hairWidth, height: hairWidth * 1.25 },
    imageWidth,
    imageHeight,
  );

  const faceWidth = face.width * 1.5;
  const faceHeight = faceWidth * 1.25;
  const faceBox = fitBox(
    { x: cx - faceWidth / 2, y: cy - faceHeight * 0.48, width: faceWidth, height: faceHeight },
    imageWidth,
    imageHeight,
  );

  return { hair, face: faceBox };
}

/** Clamp a box to the image, shifting it inward before shrinking it. */
export function fitBox(box: Box, imageWidth: number, imageHeight: number): Box {
  const width = Math.min(box.width, imageWidth);
  const height = Math.min(box.height, imageHeight);
  const x = Math.min(Math.max(box.x, 0), imageWidth - width);
  const y = Math.min(Math.max(box.y, 0), imageHeight - height);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

type Point = { x: number; y: number };

/** Head tilt in degrees from the two eye centres (image-left eye first). Positive = tilted clockwise. */
export function rollDegrees(leftEye: Point, rightEye: Point): number {
  return (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) / Math.PI;
}

/**
 * Where a point lands after rotating a `width` x `height` image clockwise by
 * `degrees` about its centre (as sharp.rotate does), on the expanded canvas.
 */
export function rotatePoint(p: Point, width: number, height: number, degrees: number, outWidth: number, outHeight: number): Point {
  const t = (degrees * Math.PI) / 180;
  const dx = p.x - width / 2;
  const dy = p.y - height / 2;
  return {
    x: dx * Math.cos(t) - dy * Math.sin(t) + outWidth / 2,
    y: dx * Math.sin(t) + dy * Math.cos(t) + outHeight / 2,
  };
}
