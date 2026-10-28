"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  before: string;
  after: string;
  alt: string;
};

/**
 * The first screen: the styled render seen through a window that opens to the edges on scroll.
 * Drag (or use arrow keys) inside the window to compare the original photo with the render.
 */
export function HeroWindow({ before, after, alt }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [split, setSplit] = useState(50);

  // Scroll progress drives --p: 0 is the small window, 1 is full-bleed
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const distance = window.innerHeight * (window.innerWidth >= 900 ? 1 : 0.7);
      const p = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / distance));
      el.style.setProperty("--p", p.toFixed(4));
      el.toggleAttribute("data-open", p > 0.42);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section ref={ref} className="hero relative" aria-labelledby="hero-heading">
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Picture layer: laid out full-bleed, only the opening changes */}
        <div className="hero__window absolute inset-0 bg-surface">
          <div className="hero__picture absolute inset-0">
            <Image
              src={after}
              alt={`${alt}, styled by Wingman`}
              fill
              priority
              sizes="100vw"
              className="object-cover object-[50%_22%] min-[900px]:object-[50%_42%]"
            />
            <div
              className="absolute inset-0"
              style={{
                clipPath: `inset(0 calc(100% - (var(--side) * var(--k) + ${split / 100} * (100% - 2 * var(--side) * var(--k)))) 0 0)`,
              }}
            >
              <Image
                src={before}
                alt={`${alt}, original photo`}
                fill
                priority
                sizes="100vw"
                className="object-cover object-[50%_22%] min-[900px]:object-[50%_42%]"
              />
            </div>
          </div>

          <div className="hero__frame">
            <span className="absolute top-3 left-3 bg-background px-2.5 py-1 text-small">Your photo</span>
            <span className="absolute top-3 right-3 bg-brass px-2.5 py-1 text-small text-background">Styled</span>

            <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
              <div className="absolute inset-y-0 -left-px w-0.5 bg-ivory" />
              <div className="absolute top-1/2 -left-6 grid size-12 -translate-y-1/2 animate-nudge place-items-center bg-ivory text-background">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
                </svg>
              </div>
            </div>

            <input
              type="range"
              min={2}
              max={98}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              aria-label="Compare original photo and styled look"
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>
        </div>

        {/* Text sits above the picture and leaves before the opening reaches it */}
        <div className="hero__text pointer-events-none absolute inset-0 px-(--margin)">
          <header className="pointer-events-auto flex h-16 items-center justify-between pt-[env(safe-area-inset-top)] md:h-20">
            <span className="font-display text-small tracking-[-0.01em] uppercase">Wingman</span>
            <nav aria-label="Main" className="flex gap-6 text-small">
              <a href="#look" className="text-link hidden md:inline">
                The look
              </a>
              <a href="#how" className="text-link hidden md:inline">
                How it works
              </a>
              <Link href="/demo" className="text-link">
                Try the demo
              </Link>
            </nav>
          </header>

          <h1
            id="hero-heading"
            className="absolute top-[calc(env(safe-area-inset-top)+4.5rem)] left-(--margin) text-[10vw] min-[900px]:top-auto min-[900px]:bottom-[calc(var(--bottom)-0.08em)] min-[900px]:max-w-[calc(var(--side)-3rem)] min-[900px]:text-[min(3.9vw,4rem)]"
          >
            <span className="rise-line">
              <span style={{ "--i": 0 } as React.CSSProperties}>See it</span>
            </span>
            <span className="rise-line">
              <span style={{ "--i": 1 } as React.CSSProperties}>on you</span>
            </span>
          </h1>

          <div className="pointer-events-auto absolute inset-x-(--margin) top-[calc(var(--win-top)+var(--win-h)+1.25rem)] min-[900px]:inset-x-auto min-[900px]:top-auto min-[900px]:right-(--margin) min-[900px]:bottom-(--bottom) min-[900px]:w-[min(calc(var(--side)-3rem),24rem)]">
            <p data-load style={{ "--d": "420ms" } as React.CSSProperties} className="max-w-[34ch] text-body">
              Wingman dresses you for the occasion: full looks from Singapore stores, tried on your own photo.
            </p>
            <div data-load style={{ "--d": "500ms" } as React.CSSProperties} className="mt-4 flex flex-col gap-1 min-[900px]:mt-6">
              <Link href="/style" className="btn w-full min-[900px]:w-auto min-[900px]:self-start">
                Start with a photo
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
