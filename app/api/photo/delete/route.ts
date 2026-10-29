import { after, NextResponse } from "next/server";
import { photoFrom } from "@/lib/api/stream";
import { normalisePhoto } from "@/lib/photo/prepare";
import { deletePhotoData } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Renders take up to about a minute, so a second sweep after two catches any that were in flight. */
const LATE_RENDER_MS = 120_000;

/**
 * POST multipart form: photo (the same image file sent to /api/style). Deletes every render and
 * cached result made from it. The photo itself is never stored, so there's nothing else to remove.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const photo = form ? await photoFrom(form) : { error: "Send the photo to delete.", status: 400 };
  if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: photo.status });
  try {
    const { hash } = await normalisePhoto(photo.bytes);
    await deletePhotoData(supabaseAdmin(), hash);
    // A render already in flight when the user tapped delete can land after this; sweep again.
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, LATE_RENDER_MS));
      await deletePhotoData(supabaseAdmin(), hash).catch((err: Error) => console.warn(`[photo/delete] ${err.message}`));
    });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[photo/delete]", err);
    return NextResponse.json({ error: "We couldn't delete your photo. Please try again." }, { status: 500 });
  }
}
