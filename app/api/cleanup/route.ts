import { NextResponse } from "next/server";
import { deleteExpired } from "@/lib/privacy";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Deletes renders and cached results older than 24 hours. Run daily by Vercel Cron (vercel.json); safe to call any time. */
export async function GET() {
  try {
    return NextResponse.json({ deleted: await deleteExpired(supabaseAdmin()) });
  } catch (err) {
    console.error("[cleanup]", err);
    return NextResponse.json({ error: "Cleanup failed." }, { status: 500 });
  }
}
