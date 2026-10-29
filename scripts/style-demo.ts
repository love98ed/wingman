/**
 * Calls POST /api/style with the demo photo and prints the looks.
 * Start the app first (npm run dev); MOCK_YOUCAM in .env.local decides mock or live renders.
 *
 *   npm run style:demo [-- --url http://localhost:3000 --tier mid --occasion "..." --max-budget 400 --photo path.jpg]
 *
 * --compare also calls POST /api/compare with the first look and prints it at all three tiers.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readEvents, type CompareEvent, type Look, type StyleResult, type TierVersion } from "@/lib/agent/events";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    photo: { type: "string", default: path.join("fixtures", "selfies", "demo.jpg") },
    occasion: { type: "string", default: "First date Friday night, rooftop bar, want to look effortless" },
    tier: { type: "string", default: "mid" },
    "max-budget": { type: "string" },
    out: { type: "string" },
    compare: { type: "boolean", default: false },
  },
});

const short = (url?: string) => (!url ? "none" : url.startsWith("data:") ? "inline (mock)" : `${url.slice(0, 70)}...`);

const photoBlob = async () => new Blob([await readFile(args.photo)], { type: "image/jpeg" });

async function main() {
  const form = new FormData();
  form.set("photo", await photoBlob(), path.basename(args.photo));
  form.set("occasion", args.occasion);
  form.set("tier", args.tier);
  if (args["max-budget"]) form.set("maxBudget", args["max-budget"]);

  console.info(`POST ${args.url}/api/style  tier=${args.tier}  "${args.occasion}"`);
  const started = Date.now();
  const res = await fetch(`${args.url}/api/style`, { method: "POST", body: form });
  if (!res.ok || !res.body) {
    console.error(`HTTP ${res.status}`, await res.text());
    process.exit(1);
  }
  // The route streams one JSON event per line; print progress and keep the final result.
  let body: StyleResult | undefined;
  await readEvents(res.body, (event) => {
    const at = `${((Date.now() - started) / 1000).toFixed(1)}s`.padStart(6);
    if (event.type === "progress") console.info(`${at}  ${event.step}${event.detail ? ` (${event.detail})` : ""}`);
    else if (event.type === "looks") console.info(`${at}  ${event.looks.length} looks picked`);
    else if (event.type === "render") console.info(`${at}  look ${event.look + 1} ${event.kind} render`);
    else if (event.type === "fitcheck") console.info(`${at}  Fit Checks in`);
    else if (event.type === "prep") console.info(`${at}  prep plan in`);
    else if (event.type === "result") body = event.result;
    else if (event.type === "error") {
      console.error(`${at}  ERROR ${event.code}: ${event.message}`);
      process.exit(1);
    }
  });
  if (!body) throw new Error("Stream ended without a result");
  console.info(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  if (args.out) await writeFile(args.out, JSON.stringify(body, null, 2));

  const o = body.occasion;
  console.info(`Occasion: ${o.occasion}, ${o.formality}, ${o.setting}, ${o.timeOfDay}; constraints: ${o.constraints.join("; ") || "none"}\n`);
  for (const look of body.looks) {
    console.info(`${look.name}  ·  Fit Check ${look.fitCheck?.score ?? "–"}/10  ·  S$${look.total.toFixed(2)}`);
    console.info(`  ${look.why}`);
    for (const item of look.items) {
      const sizes = item.sizes.map((s) => s.size).join(" ");
      console.info(`  ${item.slot.padEnd(9)} S$${item.price.toFixed(2).padStart(8)}  ${item.name} (${item.storeName}) [${sizes}]`);
    }
    console.info(`  hair: ${look.hair ?? "keep"}  beard: ${look.beard ?? "keep"}`);
    console.info(`  renders: outfit ${short(look.renders.outfit)} | hair ${short(look.renders.hair)} | beard ${short(look.renders.beard)}`);
    if (look.renders.errors.length) console.info(`  render errors: ${look.renders.errors.join(", ")}`);
    console.info(`  Fit Check: ${look.fitCheck?.reasoning ?? "none"}\n`);
  }
  console.info(`Prep plan${body.skinAnalysed ? "" : " (general, no skin analysis)"}:`);
  for (const step of body.prepPlan.steps) console.info(`  - ${step.title}: ${step.detail}`);

  if (args.compare) await compare(body.looks[0], body);
}

/** Price Compare for one look: the original tier plus the two streamed from /api/compare. */
async function compare(look: Look, body: StyleResult) {
  const form = new FormData();
  form.set("photo", await photoBlob(), path.basename(args.photo));
  form.set(
    "look",
    JSON.stringify({
      name: look.name,
      tier: look.tier,
      items: look.items.map((i) => ({ slot: i.slot, id: i.id })),
      hair: look.hair,
      occasion: body.occasion,
    }),
  );
  console.info(`\nPOST ${args.url}/api/compare  "${look.name}" from ${look.tier}`);
  const started = Date.now();
  const res = await fetch(`${args.url}/api/compare`, { method: "POST", body: form });
  if (!res.ok || !res.body) {
    console.error(`HTTP ${res.status}`, await res.text());
    process.exit(1);
  }
  const versions: TierVersion[] = [];
  await readEvents<CompareEvent>(res.body, (event) => {
    const at = `${((Date.now() - started) / 1000).toFixed(1)}s`.padStart(6);
    if (event.type === "versions") {
      versions.push(...event.versions);
      console.info(`${at}  ${event.versions.map((v) => v.tier).join(" and ")} picked`);
    } else if (event.type === "render") {
      console.info(`${at}  ${event.tier} ${event.kind} render`);
      const v = versions.find((x) => x.tier === event.tier)!;
      v.renders[event.kind] = event.url;
    } else if (event.type === "fitcheck") {
      console.info(`${at}  ${event.tier} Fit Check in`);
      versions.find((x) => x.tier === event.tier)!.fitCheck = event.check;
    } else if (event.type === "done") console.info(`${at}  done`);
    else if (event.type === "error") {
      console.error(`${at}  ERROR ${event.code}: ${event.message}`);
      process.exit(1);
    }
  });
  const all = [{ ...look, note: "(original)" }, ...versions].sort((a, b) => a.total - b.total);
  for (const v of all) {
    console.info(`\n${v.tier.toUpperCase()}  S$${v.total.toFixed(2)}  ·  Fit Check ${v.fitCheck?.score ?? "–"}/10  ${v.note}`);
    for (const item of v.items) {
      console.info(`  ${item.slot.padEnd(9)} S$${item.price.toFixed(2).padStart(8)}  ${item.name} (${item.storeName})`);
    }
    console.info(`  outfit render: ${short(v.renders.outfit)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
