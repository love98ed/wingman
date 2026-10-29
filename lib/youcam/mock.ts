import { readFile } from "node:fs/promises";
import path from "node:path";
import { YouCamError } from "./errors";

export const FIXTURE_DIR = path.join(process.cwd(), "fixtures", "youcam");

export type Fixture = { response: unknown; image?: Buffer };

/** Fixtures saved by scripts/dev/youcam-smoke.ts: `{name}.json` plus `{name}.jpg` for image APIs. */
export async function loadFixture(name: string, delayMs = 400): Promise<Fixture> {
  await new Promise((r) => setTimeout(r, delayMs));
  try {
    const response = JSON.parse(await readFile(path.join(FIXTURE_DIR, `${name}.json`), "utf8"));
    const image = await readFile(path.join(FIXTURE_DIR, `${name}.jpg`)).catch(() => undefined);
    return { response, image };
  } catch {
    throw new YouCamError(
      "UNKNOWN",
      `No YouCam fixture "${name}" in fixtures/youcam. Run npm run youcam:smoke once with real keys.`,
    );
  }
}
