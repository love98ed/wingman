"use client";

import Link from "next/link";
import { useState } from "react";
import { OCCASION_CHOICES } from "@/lib/occasions";
import { cn } from "@/lib/utils/cn";

const OCCASIONS = OCCASION_CHOICES;

/** The occasion list and the primary action it drives. */
export function OccasionPicker() {
  const [selected, setSelected] = useState<(typeof OCCASIONS)[number]["id"]>("date");
  const occasion = OCCASIONS.find((o) => o.id === selected)!;

  return (
    <section
      id="start"
      aria-labelledby="occasion-heading"
      className="relative z-10 grid gap-10 bg-background px-(--margin) pt-28 pb-32 md:grid-cols-12 md:gap-6 md:pt-40 md:pb-48"
    >
      <div className="flex flex-col md:col-span-5 md:row-start-1">
        <h2 id="occasion-heading" data-reveal className="text-head">
          The occasion
        </h2>
        <p data-reveal style={{ "--d": "80ms" } as React.CSSProperties} className="mt-6 max-w-[34ch]">
          Pick where you&apos;re headed. Next you add a photo, one sentence about the night and a budget.
        </p>
      </div>

      <ul className="flex flex-col md:col-span-6 md:col-start-7 md:row-span-2 md:row-start-1" aria-label="Occasions">
        {OCCASIONS.map((o, i) => {
          const on = selected === o.id;
          return (
            <li key={o.id} data-reveal style={{ "--d": `${120 + i * 70}ms` } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => setSelected(o.id)}
                aria-pressed={on}
                className={cn(
                  "group flex min-h-14 w-full items-center gap-4 text-left text-lead transition-[color,transform] md:text-head duration-200 ease-(--ease-out) md:min-h-18",
                  on ? "text-ivory" : "text-muted-foreground hover:translate-x-2 hover:text-ivory",
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-3 shrink-0 transition-transform duration-200", on ? "scale-100 bg-brass" : "scale-0 bg-ivory")}
                />
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div
        data-reveal
        style={{ "--d": "160ms" } as React.CSSProperties}
        className="flex flex-col gap-2 md:col-span-5 md:row-start-2 md:items-start md:self-start"
      >
        <PrimaryAction id={occasion.id} cta={occasion.cta} />
      </div>
    </section>
  );
}

function PrimaryAction({ id, cta }: { id: string; cta: string }) {
  return (
    <>
      <Link href={`/style?o=${id}`} className="btn w-full md:w-auto">
        Style me for {cta}
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </Link>
      <Link href="/demo" className="text-link flex min-h-11 items-center text-muted-foreground max-md:justify-center">
        Or try the demo, no photo needed
      </Link>
    </>
  );
}
