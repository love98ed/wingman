"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { OCCASION_CHOICES } from "@/lib/occasions";
import { cn } from "@/lib/utils/cn";
import { sgd } from "@/lib/utils/format";
import { OCCASION_LOOKS } from "./looks-data";

/**
 * The page's live thing: pick an occasion and the same man is shown in the look Wingman put
 * together for it, as a real try-on, with the real piece, store and price beside it.
 */
export function OccasionPicker() {
  const [selected, setSelected] = useState(OCCASION_CHOICES[0].id);
  const occasion = OCCASION_CHOICES.find((o) => o.id === selected)!;
  const look = OCCASION_LOOKS[selected];

  return (
    <section
      id="looks"
      aria-labelledby="occasion-heading"
      className="relative z-10 grid gap-8 bg-background px-(--margin) pt-28 pb-32 md:grid-cols-12 md:gap-6 md:pt-40 md:pb-44"
    >
      <div className="md:col-span-5 md:row-start-1">
        <h2 id="occasion-heading" data-reveal className="text-head">
          Pick the night
        </h2>
        <p data-reveal style={{ "--d": "80ms" } as React.CSSProperties} className="mt-6 max-w-[36ch]">
          Every look here is a real try-on of one photo, in pieces you can buy today from Singapore stores. Tap an
          occasion.
        </p>
      </div>

      <div className="flex flex-col md:col-span-5 md:row-start-2">
        <ul aria-label="Occasions" className="grid grid-cols-2 gap-x-4 md:grid-cols-1">
          {OCCASION_CHOICES.map((o, i) => {
            const on = selected === o.id;
            return (
              <li key={o.id} data-reveal style={{ "--d": `${120 + i * 60}ms` } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={() => setSelected(o.id)}
                  aria-pressed={on}
                  className={cn(
                    "group flex min-h-12 w-full items-center gap-3 text-left text-lead transition-[color,transform] duration-200 ease-(--ease-out) md:min-h-16",
                    on ? "text-ivory" : "text-muted-foreground hover:translate-x-1.5 hover:text-ivory",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-2.5 shrink-0 transition-[opacity,scale] duration-200", on ? "scale-100 bg-brass opacity-100" : "scale-75 bg-ivory opacity-0")}
                  />
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div data-reveal style={{ "--d": "200ms" } as React.CSSProperties} className="mt-8 md:mt-auto md:pt-10">
          <Link href={`/style?o=${occasion.id}`} className="btn w-full md:w-auto">
            Style me for {occasion.cta}
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>

      <figure className="-mx-(--margin) max-md:row-start-2 md:col-span-7 md:col-start-6 md:row-span-2 md:row-start-1 md:mx-0">
        <div data-shutter className="relative aspect-[4/5] overflow-hidden bg-surface md:aspect-auto md:h-[min(88svh,64rem)]">
          {/* Every look is mounted, so switching is an instant crossfade with nothing to load */}
          {OCCASION_CHOICES.map((o) => (
            <Image
              key={o.id}
              src={OCCASION_LOOKS[o.id].render}
              alt={o.id === selected ? `The model in ${OCCASION_LOOKS[o.id].look.toLowerCase()}, tried on by Wingman` : ""}
              aria-hidden={o.id !== selected}
              fill
              sizes="(min-width: 768px) 58vw, 100vw"
              className={cn(
                "object-cover object-[50%_30%] transition-[opacity,scale] duration-700 ease-(--ease-out)",
                o.id === selected ? "scale-100 opacity-100" : "scale-[1.03] opacity-0",
              )}
            />
          ))}
        </div>
        <figcaption aria-live="polite" className="mt-4 flex items-center gap-4 px-(--margin) md:px-0">
          <a href={look.piece.url} target="_blank" rel="noopener" className="group flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
            <span className="relative size-16 shrink-0 overflow-hidden bg-[#d9d7d2]">
              <Image src={look.piece.thumb} alt="" fill sizes="64px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-muted-foreground">{look.look}</span>
              <span className="line-clamp-2 group-hover:underline">
                {look.piece.name}, {look.piece.store}
              </span>
            </span>
          </a>
          <span className="shrink-0 text-lead tabular-nums">{sgd(look.piece.price, { whole: true })}</span>
        </figcaption>
      </figure>
    </section>
  );
}
