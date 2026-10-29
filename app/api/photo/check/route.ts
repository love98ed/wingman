import { NextResponse } from "next/server";
import { photoFrom } from "@/lib/api/stream";
import { checkPhoto } from "@/lib/photo/check";

/**
 * POST multipart form: photo. Says whether it will work for a try-on, and if not, why and how to
 * fix it. One Claude call per new photo, no YouCam units. Nothing is stored but the cached answer.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const photo = form ? await photoFrom(form) : { error: "Add a photo.", status: 400 };
  if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: photo.status });
  try {
    return NextResponse.json(await checkPhoto(photo.bytes));
  } catch (err) {
    console.error("[photo/check]", err);
    return NextResponse.json({ error: "We couldn't read that photo. Try another one." }, { status: 422 });
  }
}
