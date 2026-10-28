import { NextResponse } from "next/server";
import type { StyleEvent } from "@/lib/agent/events";
import { runStyle } from "@/lib/agent/style";
import { StyleRequestSchema } from "@/lib/agent/schemas";
import { YouCamError, friendlyMessage } from "@/lib/youcam/errors";

// Several Claude calls and chained YouCam renders; well over the default limit.
export const maxDuration = 300;

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

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

  const photo = form.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) {
    return NextResponse.json({ error: "Add a photo." }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Use one under 10 MB." }, { status: 413 });
  }

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
  const bytes = Buffer.from(await photo.arrayBuffer());
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StyleEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runStyle(bytes, fields.data, send);
      } catch (err) {
        if (err instanceof YouCamError) {
          send({ type: "error", code: err.code, message: friendlyMessage(err.code) });
        } else {
          console.error("[style]", err);
          send({ type: "error", code: "UNKNOWN", message: "Something went wrong while styling. Please try again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
