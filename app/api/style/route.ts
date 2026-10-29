import { NextResponse } from "next/server";
import type { StyleEvent } from "@/lib/agent/events";
import { runStyle } from "@/lib/agent/style";
import { StyleRequestSchema } from "@/lib/agent/schemas";
import { eventStream, photoFrom } from "@/lib/agent/stream";

// Several Claude calls and chained YouCam renders; well over the default limit.
export const maxDuration = 300;

/**
 * POST multipart form: photo (image file), occasion (one sentence), tier, optional maxBudget.
 * Bad input gets a JSON error; otherwise the response is a stream of StyleEvent lines.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send the photo and details as a multipart form." }, { status: 400 });
  }

  const photo = await photoFrom(form);
  if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: photo.status });

  const fields = StyleRequestSchema.safeParse({
    occasion: form.get("occasion"),
    tier: form.get("tier"),
    maxBudget: form.get("maxBudget") || undefined,
  });
  if (!fields.success) {
    return NextResponse.json({ error: "Tell us the occasion and pick a budget.", issues: fields.error.issues }, { status: 400 });
  }

  // Stream events as newline-delimited JSON so the client can show the outfit render
  // as soon as it lands. Errors after this point arrive as an "error" event.
  return eventStream<StyleEvent>("style", (send) => runStyle(photo.bytes, fields.data, send));
}
