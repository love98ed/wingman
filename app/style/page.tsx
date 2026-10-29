import type { Metadata } from "next";
import { StyleFlow } from "@/components/style/style-flow";
import { OCCASIONS, type Occasion } from "@/lib/catalog/types";

export const metadata: Metadata = { title: "Style me" };

export default async function StylePage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  const initial = OCCASIONS.includes(o as Occasion) ? (o as Occasion) : undefined;
  return <StyleFlow initialOccasion={initial} />;
}
