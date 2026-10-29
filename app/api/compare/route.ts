import { NextResponse } from "next/server";
import { runCompare } from "@/lib/agent/compare";
import type { CompareEvent } from "@/lib/agent/events";
import { CompareRequestSchema } from "@/lib/agent/schemas";
import { eventStream, photoFrom } from "@/lib/agent/stream";

// One Claude match, two try-ons and two Fit Checks.
export const maxDuration = 300;

/**
 * POST multipart form: photo (the same image file as /api/style) and look (JSON: name, tier,
 * items [{slot, id}], hair, occasion). Streams CompareEvent lines for the two other tiers.
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
  const fields = CompareRequestSchema.safeParse(look);
  if (!fields.success) {
    return NextResponse.json({ error: "Send the look to compare.", issues: fields.error.issues }, { status: 400 });
  }

  return eventStream<CompareEvent>("compare", (send) => runCompare(photo.bytes, fields.data, send));
}
