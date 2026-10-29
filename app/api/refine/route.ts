import { NextResponse } from "next/server";
import type { StyleEvent } from "@/lib/agent/events";
import { RefineRequestSchema } from "@/lib/agent/schemas";
import { eventStream, photoFrom } from "@/lib/agent/stream";
import { runRefine } from "@/lib/agent/style";

// A Claude brief update, a new selection, renders and Fit Checks.
export const maxDuration = 300;

/**
 * POST multipart form: photo (the same image file as /api/style) and refine (JSON: message,
 * sentence, tier, occasion, previous looks). Streams the same StyleEvent lines as /api/style,
 * without the prep plan or a final result.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send the photo and your request as a multipart form." }, { status: 400 });
  }

  const photo = await photoFrom(form);
  if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: photo.status });

  let body: unknown;
  try {
    body = JSON.parse(String(form.get("refine") ?? ""));
  } catch {
    body = null;
  }
  const fields = RefineRequestSchema.safeParse(body);
  if (!fields.success) {
    return NextResponse.json({ error: "Tell Wingman what to change.", issues: fields.error.issues }, { status: 400 });
  }

  return eventStream<StyleEvent>("refine", (send) => runRefine(photo.bytes, fields.data, send));
}
