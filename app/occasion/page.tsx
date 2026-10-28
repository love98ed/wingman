import { redirect } from "next/navigation";

/** Old entry point; the flow now lives at /style. */
export default async function OccasionPage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  redirect(o ? `/style?o=${encodeURIComponent(o)}` : "/style");
}
