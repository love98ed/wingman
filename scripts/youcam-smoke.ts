/**
 * One real call each for clothes VTO, skin analysis, hair VTO (plus hair on the
 * clothes render, to test chaining) and beard VTO on fixtures/selfies/demo.jpg.
 * Saves raw responses and images to fixtures/youcam/ for MOCK_YOUCAM mode.
 * A second run is served from the render cache and costs zero units.
 *
 *   npm run youcam:smoke [-- --garment <url> --product-id <id> --hair-template <id> --beard-template <id>]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { getServerEnv } from "@/lib/env.server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { YouCamClient, type Template, type YouCamResult } from "@/lib/youcam/client";
import { UnitGuard } from "@/lib/youcam/guard";
import { YouCamHttp } from "@/lib/youcam/http";
import { FIXTURE_DIR } from "@/lib/youcam/mock";
import { headShouldersFrom, preparePhoto } from "@/lib/photo/prepare";
import { SupabaseRenderCache, SupabaseUsageStore } from "@/lib/youcam/supabase-stores";

const DEMO_PHOTO = path.join(process.cwd(), "fixtures", "selfies", "demo.jpg");

// DUXTON Regular Fit Camp Collar Shirt - Retro Spade (front view), resized under YouCam's 4096px limit.
const DEFAULT_GARMENT =
  "https://cdn.shopify.com/s/files/1/0098/6198/8414/files/RegularFitCampShirt-RetroSpade_Front.png?width=1600";
const DEFAULT_PRODUCT_ID = "duxton.com-7583296815304";

const { values: args } = parseArgs({
  options: {
    garment: { type: "string", default: DEFAULT_GARMENT },
    "product-id": { type: "string", default: DEFAULT_PRODUCT_ID },
    "hair-template": { type: "string" },
    "beard-template": { type: "string" },
  },
});

async function save(name: string, result: { response: unknown; image?: Buffer }) {
  await writeFile(path.join(FIXTURE_DIR, `${name}.json`), JSON.stringify(result.response, null, 2));
  if (result.image) await writeFile(path.join(FIXTURE_DIR, `${name}.jpg`), result.image);
}

/** Use the preferred template if present, else the first one. */
function pickTemplate(templates: Template[], preferred: RegExp, override?: string): Template | undefined {
  if (override) return templates.find((t) => t.id === override) ?? { id: override, title: "(from --flag)" };
  return templates.find((t) => preferred.test(t.title)) ?? templates[0];
}

type Row = { step: string; outcome: string };
const rows: Row[] = [];

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  const started = Date.now();
  try {
    const result = await fn();
    const source = (result as Partial<YouCamResult>)?.source;
    rows.push({ step: name, outcome: `ok${source ? ` (${source})` : ""} in ${((Date.now() - started) / 1000).toFixed(1)}s` });
    return result;
  } catch (err) {
    const e = err as Error & { code?: string; detail?: string };
    rows.push({ step: name, outcome: `FAILED ${e.code ?? ""} ${e.detail ?? ""} ${e.message}`.replace(/\s+/g, " ") });
    return undefined;
  }
}

async function main() {
  const env = getServerEnv();
  const photoBytes = await readFile(DEMO_PHOTO).catch(() => {
    console.error(`Missing ${DEMO_PHOTO}. Add a waist-up, front-facing photo named demo.jpg.`);
    process.exit(1);
  });

  const db = supabaseAdmin();
  const usage = new SupabaseUsageStore(db);
  const guard = new UnitGuard(usage, env.YOUCAM_UNIT_LIMIT, console.info);
  // Always live: this script exists to capture real responses for mock mode.
  const yc = new YouCamClient({
    http: new YouCamHttp(env.YOUCAM_API_KEY),
    guard,
    cache: new SupabaseRenderCache(db),
    mock: false,
  });

  await mkdir(path.join(FIXTURE_DIR, "inputs"), { recursive: true });
  const before = await guard.total();
  console.info(`YouCam units used before: ${before}/${env.YOUCAM_UNIT_LIMIT}\n`);

  const photo = await step("prepare photo (Claude face box + crops)", () => preparePhoto(photoBytes));
  if (!photo) return report(guard, before, env.YOUCAM_UNIT_LIMIT);
  await writeFile(path.join(FIXTURE_DIR, "inputs", "full.jpg"), photo.full);
  await writeFile(path.join(FIXTURE_DIR, "inputs", "head-shoulders.jpg"), photo.headShoulders);
  await writeFile(path.join(FIXTURE_DIR, "inputs", "close-face.jpg"), photo.closeFace);
  await writeFile(path.join(FIXTURE_DIR, "inputs", "face.json"), JSON.stringify({ face: photo.face, size: photo.size }, null, 2));

  const clothes = await step("clothes VTO (cloth-v3, auto)", () =>
    yc.tryOnClothes({
      photo: photo.full,
      selfieHash: photo.hash,
      productId: args["product-id"],
      garmentUrl: args.garment,
    }),
  );
  if (clothes) await save("clothes", clothes);

  const skin = await step("skin analysis (SD, 4 concerns)", () =>
    yc.analyzeSkin({ photo: photo.closeFace, selfieHash: photo.hash }),
  );
  if (skin) await save("skin", skin);

  const hairTemplates = await step("list hair templates", () => yc.listTemplates("hair"));
  if (hairTemplates) {
    await writeFile(path.join(FIXTURE_DIR, "hair-templates.json"), JSON.stringify(hairTemplates, null, 2));
    const t = pickTemplate(hairTemplates, /^Modern Slick Back$/, args["hair-template"]);
    if (t) {
      console.info(`Hair template: ${t.title} (${t.id})`);
      const hair = await step("hair VTO on photo", () =>
        yc.tryOnHair({ photo: photo.headShoulders, selfieHash: photo.hash, templateId: t.id }),
      );
      if (hair) await save("hair", hair);

      if (clothes?.image) {
        const chainedSrc = await headShouldersFrom(clothes.image, photo);
        const chained = await step("hair VTO on clothes render (chain test)", () =>
          yc.tryOnHair({
            photo: chainedSrc,
            selfieHash: photo.hash,
            templateId: t.id,
            source: `clothes:${args["product-id"]}`,
          }),
        );
        if (chained) await save("hair-chained", chained);
      }
    }
  }

  const beardTemplates = await step("list beard templates", () => yc.listTemplates("beard"));
  if (beardTemplates) {
    await writeFile(path.join(FIXTURE_DIR, "beard-templates.json"), JSON.stringify(beardTemplates, null, 2));
    const t = pickTemplate(beardTemplates, /^Circle$/, args["beard-template"]);
    if (t) {
      console.info(`Beard template: ${t.title} (${t.id})`);
      const beard = await step("beard VTO", () =>
        yc.tryOnBeard({ photo: photo.closeFace, selfieHash: photo.hash, templateId: t.id }),
      );
      if (beard) await save("beard", beard);
    }
  }

  await report(guard, before, env.YOUCAM_UNIT_LIMIT);
}

async function report(guard: UnitGuard, before: number, limit: number) {
  const after = await guard.total();
  console.info("\nStep".padEnd(46) + "Outcome");
  for (const r of rows) console.info(`${r.step.padEnd(45)} ${r.outcome}`);
  console.info(`\nUnits this run: ${after - before}   Total: ${after}/${limit}`);
  console.info("By API:", await guard.totalsByApi());
  console.info(`Fixtures saved to ${path.relative(process.cwd(), FIXTURE_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
