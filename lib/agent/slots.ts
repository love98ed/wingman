import type { Category } from "@/lib/catalog/types";

/** The catalog slots a look is built from. Glasses and accessories are out of scope for now. No dependencies: the browser imports it. */
export const SLOTS = ["top", "outerwear", "bottom", "shoes", "watch"] as const satisfies readonly Category[];
export type Slot = (typeof SLOTS)[number];
