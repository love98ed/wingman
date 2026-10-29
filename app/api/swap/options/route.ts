import { NextResponse } from "next/server";
import { AgentError } from "@/lib/agent/errors";
import { swapOptions } from "@/lib/agent/flows/swap";
import { SwapOptionsRequestSchema } from "@/lib/agent/schemas";

/** POST JSON: a look (name, tier, items, hair, occasion) and the slot to swap. Returns { options: LookItem[] }. */
export async function POST(request: Request) {
  const fields = SwapOptionsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!fields.success) {
    return NextResponse.json({ error: "Send the look and the piece to swap.", issues: fields.error.issues }, { status: 400 });
  }
  try {
    return NextResponse.json({ options: await swapOptions(fields.data) });
  } catch (err) {
    if (err instanceof AgentError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error("[swap/options]", err);
    return NextResponse.json({ error: "We couldn't load alternatives. Please try again." }, { status: 500 });
  }
}
