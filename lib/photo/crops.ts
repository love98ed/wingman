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
  const hair = fit(
    { x: cx - hairWidth / 2, y: face.y - face.height * 0.7, width: hairWidth, height: hairWidth * 1.25 },
    imageWidth,
    imageHeight,
  );

  const faceWidth = face.width * 1.5;
  const faceHeight = faceWidth * 1.25;
  const faceBox = fit(
    { x: cx - faceWidth / 2, y: cy - faceHeight * 0.48, width: faceWidth, height: faceHeight },
    imageWidth,
    imageHeight,
  );

  return { hair, face: faceBox };
}

function fit(box: Box, imageWidth: number, imageHeight: number): Box {
  const width = Math.min(box.width, imageWidth);
  const height = Math.min(box.height, imageHeight);
  const x = Math.min(Math.max(box.x, 0), imageWidth - width);
  const y = Math.min(Math.max(box.y, 0), imageHeight - height);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
