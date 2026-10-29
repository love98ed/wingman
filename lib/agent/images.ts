/**
 * Which try-on images each look waits for, and how many have landed. Safe to import from
 * client components: the loading screen uses it to hold until every image is settled.
 */
import type { Look, RenderKind } from "./events";

/** The images a look gets: the outfit when it has a top or jacket, then hair and beard when picked. */
export function expectedKinds(look: Pick<Look, "items" | "hair" | "beard">): RenderKind[] {
  const kinds: RenderKind[] = [];
  if (look.items.some((i) => i.slot === "top" || i.slot === "outerwear")) kinds.push("outfit");
  if (look.hair) kinds.push("hair");
  if (look.beard) kinds.push("beard");
  return kinds;
}

export type ImageFailure = { look: number; kind: RenderKind; code: string };

export type ImageStatus = {
  total: number;
  ready: number;
  failed: ImageFailure[];
  /** Every failure is the unit cap: trying again won't help until it's raised. */
  outOfUnits: boolean;
};

export function imageStatus(looks: Look[]): ImageStatus {
  let total = 0;
  let ready = 0;
  const failed: ImageFailure[] = [];
  looks.forEach((look, i) => {
    for (const kind of expectedKinds(look)) {
      total++;
      if (look.renders[kind]) ready++;
      else if (look.renders.failed?.[kind]) failed.push({ look: i, kind, code: look.renders.failed[kind]! });
    }
  });
  return { total, ready, failed, outOfUnits: failed.length > 0 && failed.every((f) => f.code === "QUOTA") };
}
