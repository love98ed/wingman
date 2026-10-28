import { NextResponse } from "next/server";
import { runStyle } from "@/lib/agent/style";
import { StyleRequestSchema } from "@/lib/agent/schemas";
import { YouCamError, friendlyMessage } from "@/lib/youcam/errors";

// Several Claude calls and chained YouCam renders; well over the default limit.
export const maxDuration = 300;

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** POST multipart form: photo (image file), occasion (one sentence), tier, optional maxBudget. */
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

  try {
    const result = await runStyle(Buffer.from(await photo.arrayBuffer()), fields.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof YouCamError) {
      const status = err.code === "QUOTA" ? 503 : err.code === "TIMEOUT" ? 504 : 422;
      return NextResponse.json({ error: friendlyMessage(err.code), code: err.code }, { status });
    }
    console.error("[style]", err);
    return NextResponse.json({ error: "Something went wrong while styling. Please try again." }, { status: 500 });
  }
}
