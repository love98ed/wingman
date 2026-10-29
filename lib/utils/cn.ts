import { createCn } from "cn/config";

// Our type steps (globals.css @theme) are font sizes; without this, cn reads text-small as a colour
// and drops it whenever a text colour follows, e.g. cn("text-small", "text-background")
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["small", "body", "lead", "head", "display"] }] } },
});
