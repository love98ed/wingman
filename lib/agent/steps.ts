import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { generateStructured } from "@/lib/llm/client";
import type { Tier } from "@/lib/catalog/types";
import { poolLines, SLOTS, type LookItems, type Pool } from "./catalog";
import { tierPoolLines, type TierPool } from "./match";
import { BEARD_STYLES, HAIR_STYLES } from "./grooming";
import {
  FitCheckSchema,
  LookPicksSchema,
  ParsedOccasionSchema,
  PrepPlanSchema,
  TierPicksSchema,
  type LookPick,
  type ParsedOccasion,
  type PrepPlan,
  type TierPick,
} from "./schemas";

/** JPEG block for Claude vision, long side capped to keep image tokens down. */
async function imageBlock(jpeg: Buffer, longSide = 1024): Promise<Anthropic.ImageBlockParam> {
  const data = await sharp(jpeg).resize(longSide, longSide, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: data.toString("base64") } };
}

/** Step 1: one sentence about the event into structured fields. */
export async function parseOccasion(text: string) {
  return generateStructured({
    task: "agent",
    label: "parse-occasion",
    effort: "low",
    schema: ParsedOccasionSchema,
    system:
      "You read one sentence a man wrote about an upcoming event in Singapore and classify it. " +
      "occasion is the closest of: date, interview, wedding (as a guest), cny (Chinese New Year visiting), " +
      "dnd (company dinner and dance), night-out. formality is what the event calls for. " +
      "constraints are explicit wishes or limits he states (colours, items to avoid, weather, dress code), short phrases.",
    content: [{ type: "text", text }],
  });
}

/** Step 3: 2 to 3 looks from the candidate pool, colours chosen for his face and skin tone. */
export async function selectLooks(args: {
  occasion: ParsedOccasion;
  sentence: string;
  pool: Pool;
  face: Buffer;
  /** Problems with a previous attempt, sent back for one correction. */
  errors?: string[];
}): Promise<LookPick[]> {
  const { occasion } = args;
  const brief = [
    `He wrote: "${args.sentence}"`,
    `Occasion: ${occasion.occasion}, ${occasion.formality}, ${occasion.setting}, ${occasion.timeOfDay}.`,
    occasion.constraints.length ? `His constraints: ${occasion.constraints.join("; ")}.` : "",
    `Budget tier: ${occasion.budgetTier}.`,
    occasion.maxBudget ? `Each look must total S$${occasion.maxBudget} or less.` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const result = await generateStructured({
    task: "agent",
    label: "select-looks",
    effort: "medium",
    schema: LookPicksSchema,
    system:
      "You are Wingman, a menswear stylist in Singapore. Build 3 distinct, coherent outfits (2 only if the list is thin) " +
      "for this man and this occasion, using only the product ids listed. Each look needs a top, a bottom and shoes; " +
      "outerwear and a watch are optional (use null). Add a watch only when it lifts the look and keeps the total sensible " +
      "for the budget tier; the clothes come first. Prefer one or two stores per look so checkout stays simple. " +
      "Choose colours that flatter the skin tone and colouring you see in his photo. The photo may show glasses; ignore them. " +
      `hair is one of [${HAIR_STYLES.join(", ")}] or null to keep his current hair. ` +
      `beard is one of [${BEARD_STYLES.join(", ")}] or null to keep his current beard; only change it when it clearly helps. ` +
      "name is 2 to 4 words. why is one sentence on why the look works for him and the occasion. Singapore is hot and humid.",
    content: [
      await imageBlock(args.face, 800),
      {
        type: "text",
        text:
          `${brief}\n\nCandidates (id | name | colour | formality | price | store):\n\n${poolLines(args.pool)}` +
          (args.errors?.length ? `\n\nYour previous answer had these problems. Fix them:\n- ${args.errors.join("\n- ")}` : ""),
      },
    ],
  });
  return result.looks;
}

/** Price Compare: rebuild one look at other tiers, keeping colour, cut and formality. */
export async function matchTiers(args: {
  occasion: ParsedOccasion;
  look: LookItems;
  from: Tier;
  pools: Partial<Record<Tier, TierPool>>;
  errors?: string[];
}): Promise<TierPick[]> {
  const original = SLOTS.filter((slot) => args.look[slot])
    .map((slot) => {
      const p = args.look[slot]!;
      return `${slot}: ${p.name} | ${p.colour} | ${p.formality} | S$${p.price.toFixed(0)} | ${p.storeName}`;
    })
    .join("\n");
  const tiers = Object.keys(args.pools) as Tier[];
  const result = await generateStructured({
    task: "agent",
    label: "match-tiers",
    effort: "low",
    schema: TierPicksSchema,
    system:
      "You are Wingman, a menswear stylist in Singapore. A man liked a look; show him the same look at other price tiers. " +
      "For each target tier and each slot of the look, choose the candidate that keeps the style direction: the same colour " +
      "(or the nearest shade), the same cut and garment type (an oxford shirt stays an oxford shirt, loafers stay loafers, " +
      "a field watch stays a field watch) and the same formality. The look should be recognisably the same outfit at a " +
      "different price. Use only the listed ids, null for slots the look doesn't have. note is one short sentence on what " +
      "he gets or gives up at that price (fabric, make, details), not a list of items.",
    content: [
      {
        type: "text",
        text:
          `Occasion: ${args.occasion.occasion}, ${args.occasion.formality}, ${args.occasion.setting}.\n\n` +
          `The look (${args.from} tier):\n${original}\n\n` +
          tiers.map((t) => `## ${t} tier candidates (id | name | colour | formality | price | store)\n${tierPoolLines(args.pools[t]!)}`).join("\n\n") +
          `\n\nReturn one version for each of: ${tiers.join(", ")}.` +
          (args.errors?.length ? `\n\nYour previous answer had these problems. Fix them:\n- ${args.errors.join("\n- ")}` : ""),
      },
    ],
  });
  return result.versions;
}

/** Step 5: score each rendered look out of 10 with a one or two sentence reason. */
export async function fitCheck(args: {
  occasion: ParsedOccasion;
  looks: { name: string; items: string; render?: Buffer }[];
}) {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const [i, look] of args.looks.entries()) {
    content.push({ type: "text", text: `Look ${i + 1}: ${look.name}. Pieces: ${look.items}.` });
    if (look.render) content.push(await imageBlock(look.render));
  }
  content.push({
    type: "text",
    text: `Occasion: ${args.occasion.occasion}, ${args.occasion.formality}, ${args.occasion.setting}, ${args.occasion.timeOfDay}.`,
  });
  const result = await generateStructured({
    task: "agent",
    label: "fit-check",
    effort: "low",
    schema: FitCheckSchema,
    system:
      "You are Wingman's Fit Check. For each look, in order, give an honest score out of 10 (one decimal) for how well it " +
      "suits this man and the occasion, judged from the try-on render where there is one (otherwise from the pieces, " +
      "without mentioning that there is no render), and 1 to 2 short sentences of " +
      "reasoning in second person. Talk about fit, colour against his skin tone, formality and the setting. " +
      "Never comment on his body, weight or face shape negatively. Ignore glasses.",
    content,
  });
  return args.looks.map((_, i) => result.checks[i] ?? { score: 7, reasoning: "A solid, occasion-appropriate look." });
}

/** Step 6: a three-step night-before grooming routine. No medical claims. */
export async function prepPlan(args: { occasion: ParsedOccasion; skin: string | null }): Promise<PrepPlan> {
  return generateStructured({
    task: "agent",
    label: "prep-plan",
    effort: "low",
    schema: PrepPlanSchema,
    system:
      "You write a three-step grooming routine for the night before an event. Each step has a short title (2 to 4 words) " +
      "and one or two plain sentences. Cosmetic grooming only: cleansing, moisturising, shaving or beard care, hair, rest, " +
      "hydration. No medical claims, no diagnosis, no treating conditions, no named prescription products. " +
      "If skin readings are given, use them to choose emphasis without quoting numbers or naming conditions.",
    content: [
      {
        type: "text",
        text:
          `Event: ${args.occasion.occasion}, ${args.occasion.setting}, ${args.occasion.timeOfDay}.\n` +
          (args.skin ? `Skin readings (0 to 100, higher is better): ${args.skin}.` : "No skin readings; keep it general."),
      },
    ],
  });
}
