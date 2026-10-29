/**
 * Check a photo before spending YouCam units: finds the face (one cheap Claude
 * call) and writes the crops each YouCam API would receive.
 *
 *   npm run photo:check [-- path/to/photo.jpg]   (default fixtures/selfies/demo.jpg)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { preparePhoto } from "@/lib/photo/prepare";

const input = process.argv[2] ?? path.join("fixtures", "selfies", "demo.jpg");
const outDir = path.join("fixtures", "youcam", "inputs");

async function main() {
  const photo = await preparePhoto(await readFile(input));
  await mkdir(outDir, { recursive: true });

  const outputs = {
    "full.jpg": photo.full,
    "head-shoulders.jpg": photo.headShoulders,
    "close-face.jpg": photo.closeFace,
  };
  console.info(`Photo ${photo.size.width}x${photo.size.height}, face ${photo.face.width}x${photo.face.height}px at (${photo.face.x}, ${photo.face.y}), tilt ${photo.face.roll.toFixed(1)}°`);
  for (const [name, bytes] of Object.entries(outputs)) {
    await writeFile(path.join(outDir, name), bytes);
    const { width, height } = await sharp(bytes).metadata();
    console.info(`  ${name.padEnd(20)} ${width}x${height}`);
  }
  console.info(`Crops written to ${outDir}/. Look at them before running npm run youcam:smoke.`);
}

main().catch((err) => {
  console.error(`Photo check failed: ${err.code ?? ""} ${err.message}`);
  process.exit(1);
});
