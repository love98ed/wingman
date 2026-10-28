/**
 * Calls POST /api/style with the demo photo and prints the looks.
 * Start the app first (npm run dev); MOCK_YOUCAM in .env.local decides mock or live renders.
 *
 *   npm run style:demo [-- --url http://localhost:3000 --tier mid --occasion "..." --max-budget 400 --photo path.jpg]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    photo: { type: "string", default: path.join("fixtures", "selfies", "demo.jpg") },
    occasion: { type: "string", default: "First date Friday night, rooftop bar, want to look effortless" },
    tier: { type: "string", default: "mid" },
    "max-budget": { type: "string" },
    out: { type: "string" },
  },
});

type Look = {
  name: string;
  why: string;
  total: number;
  hair: string | null;
  beard: string | null;
  fitCheck: { score: number; reasoning: string };
  items: { slot: string; name: string; storeName: string; price: number; sizes: { size: string }[] }[];
  renders: { outfit?: string; hair?: string; beard?: string; errors: string[] };
};

const short = (url?: string) => (!url ? "none" : url.startsWith("data:") ? "inline (mock)" : `${url.slice(0, 70)}...`);

async function main() {
  const form = new FormData();
  form.set("photo", new Blob([await readFile(args.photo)], { type: "image/jpeg" }), path.basename(args.photo));
  form.set("occasion", args.occasion);
  form.set("tier", args.tier);
  if (args["max-budget"]) form.set("maxBudget", args["max-budget"]);

  console.info(`POST ${args.url}/api/style  tier=${args.tier}  "${args.occasion}"`);
  const started = Date.now();
  const res = await fetch(`${args.url}/api/style`, { method: "POST", body: form });
  const body = await res.json();
  console.info(`HTTP ${res.status} in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  if (!res.ok) {
    console.error(body);
    process.exit(1);
  }
  if (args.out) await writeFile(args.out, JSON.stringify(body, null, 2));

  const o = body.occasion;
  console.info(`Occasion: ${o.occasion}, ${o.formality}, ${o.setting}, ${o.timeOfDay}; constraints: ${o.constraints.join("; ") || "none"}\n`);
  for (const look of body.looks as Look[]) {
    console.info(`${look.name}  ·  Fit Check ${look.fitCheck.score}/10  ·  S$${look.total.toFixed(2)}`);
    console.info(`  ${look.why}`);
    for (const item of look.items) {
      const sizes = item.sizes.map((s) => s.size).join(" ");
      console.info(`  ${item.slot.padEnd(9)} S$${item.price.toFixed(2).padStart(8)}  ${item.name} (${item.storeName}) [${sizes}]`);
    }
    console.info(`  hair: ${look.hair ?? "keep"}  beard: ${look.beard ?? "keep"}`);
    console.info(`  renders: outfit ${short(look.renders.outfit)} | hair ${short(look.renders.hair)} | beard ${short(look.renders.beard)}`);
    if (look.renders.errors.length) console.info(`  render errors: ${look.renders.errors.join(", ")}`);
    console.info(`  Fit Check: ${look.fitCheck.reasoning}\n`);
  }
  console.info(`Prep plan${body.skinAnalysed ? "" : " (general, no skin analysis)"}:`);
  for (const step of body.prepPlan.steps) console.info(`  - ${step.title}: ${step.detail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
