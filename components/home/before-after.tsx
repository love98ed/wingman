"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  before: string;
  after: string;
  alt: string;
  /** Caption chips shown over the "after" side. */
  tags: string[];
};

/** Drag (or use arrow keys) to reveal the styled render over the original photo. */
export function BeforeAfter({ before, after, alt, tags }: Props) {
  const [split, setSplit] = useState(52);

  return (
    <figure className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-surface shadow-[0_30px_80px_-30px_rgb(200_169_106/0.35)]">
      <Image src={after} alt={`${alt}, styled by Wingman`} fill priority sizes="(max-width: 480px) 100vw, 440px" className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
        <Image src={before} alt={`${alt}, original photo`} fill priority sizes="(max-width: 480px) 100vw, 440px" className="object-cover" />
      </div>

      {/* Bottom fade so captions stay legible */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent" />

      <span className="glass absolute top-4 left-4 rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-ivory/80 uppercase">
        Before
      </span>
      <span className="absolute top-4 right-4 rounded-full bg-brass px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-background uppercase">
        After
      </span>

      <figcaption className="absolute inset-x-4 bottom-4 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="glass rounded-full px-2.5 py-1 text-xs text-ivory/90">
            {tag}
          </span>
        ))}
      </figcaption>

      {/* Divider and handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-ivory/90 shadow-[0_0_12px_rgb(0_0_0/0.5)]" />
        <div className="absolute top-1/2 -left-6 grid size-12 -translate-y-1/2 animate-nudge place-items-center rounded-full border border-white/30 bg-ivory text-background shadow-lg">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>

      <input
        type="range"
        min={4}
        max={96}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-label="Compare original photo and styled look"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </figure>
  );
}
