"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

const OCCASIONS = [
  { id: "date", label: "First date", cta: "a first date" },
  { id: "interview", label: "Interview", cta: "the interview" },
  { id: "wedding", label: "Wedding guest", cta: "the wedding" },
  { id: "cny", label: "CNY visiting", cta: "CNY visiting" },
  { id: "dnd", label: "Company D&D", cta: "the D&D" },
  { id: "night-out", label: "Night out", cta: "a night out" },
] as const;

/** Occasion chips plus the bottom-anchored call to action they drive. */
export function OccasionCta() {
  const [selected, setSelected] = useState<(typeof OCCASIONS)[number]["id"]>("date");
  const occasion = OCCASIONS.find((o) => o.id === selected)!;

  return (
    <>
      <section aria-labelledby="occasion-heading" className="animate-rise [animation-delay:240ms]">
        <h2 id="occasion-heading" className="px-5 font-sans text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          What&apos;s the occasion?
        </h2>
        <div className="no-scrollbar mt-3 flex snap-x gap-2 overflow-x-auto px-5 pb-1">
          {OCCASIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelected(o.id)}
              aria-pressed={selected === o.id}
              className={cn(
                "h-11 shrink-0 snap-start rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
                selected === o.id
                  ? "border-brass bg-brass/15 text-brass-bright"
                  : "border-border bg-surface text-ivory/80 hover:border-ivory/25",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md bg-gradient-to-t from-background via-background/95 to-transparent px-5 pt-10 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <Link
          href={`/occasion?o=${occasion.id}`}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brass-bright to-brass text-[15px] font-semibold text-background shadow-[0_12px_40px_-12px_rgb(200_169_106/0.7)] transition-transform active:scale-[0.98]"
        >
          Style me for {occasion.cta}
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </Link>
        <Link
          href="/demo"
          className="mt-2 flex h-11 w-full items-center justify-center text-sm text-ivory/70 underline-offset-4 hover:text-ivory hover:underline"
        >
          Or try the demo, no photo needed
        </Link>
      </div>
    </>
  );
}
