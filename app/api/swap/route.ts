import { NextResponse } from "next/server";
import type { SwapEvent } from "@/lib/agent/events";
import { SwapRequestSchema } from "@/lib/agent/schemas";
import { eventStream, photoFrom } from "@/lib/agent/stream";
import { runSwap } from "@/lib/agent/swap";

// One try-on (plus hair when the look has it) and a Fit Check.
export const maxDuration = 300;

/**
 * POST multipart form: photo (the same image file as /api/style) and look (JSON: name, tier,
 * items [{slot, id}] with the new piece in place, hair, occasion). Streams SwapEvent lines.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send the photo and the look as a multipart form." }, { status: 400 });
  }

  const photo = await photoFrom(form);
  if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: photo.status });

  let look: unknown;
  try {
    look = JSON.parse(String(form.get("look") ?? ""));
  } catch {
    look = null;
  }
  const fields = SwapRequestSchema.safeParse(look);
  if (!fields.success) {
    return NextResponse.json({ error: "Send the look with the new piece.", issues: fields.error.issues }, { status: 400 });
  }

  return eventStream<SwapEvent>("swap", (send) => runSwap(photo.bytes, fields.data, send));
}
