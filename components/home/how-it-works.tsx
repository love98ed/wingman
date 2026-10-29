import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** Three stages, each tile larger than the one before, so size carries the order. */
const STAGES = [
  {
    name: "Snap one photo",
    body: "Waist up, facing the camera. Your try-ons are deleted after 24 hours.",
    span: "md:col-span-3",
    tile: "h-[34vw] md:h-[30vh] bg-surface-raised",
    picture: { src: "/home/before.jpg", alt: "The original photo, waist up in a white T-shirt" },
  },
  {
    name: "Say where you're going",
    body: "One sentence and a budget. Wingman picks in-stock pieces from local stores.",
    span: "md:col-span-4",
    tile: "h-[46vw] md:h-[44vh] bg-brass text-background",
    quote: "First date Friday night, rooftop bar, mid-range.",
  },
  {
    name: "Wear it, buy it",
    body: "Each look on you with a Fit Check, and one cart per store.",
    span: "md:col-span-5",
    tile: "h-[62vw] md:h-[60vh] bg-surface-raised",
    picture: { src: "/home/night-out.jpg", alt: "The same photo, tried on in an olive ikat shirt" },
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="relative z-10 bg-background px-(--margin) py-28 md:py-44">
      <div className="relative">
        <h2 id="how-heading" data-reveal className="text-head md:absolute md:top-0 md:left-0 md:max-w-[56%]">
          How it works
        </h2>
        <ol className="mt-10 grid gap-7 md:mt-0 md:grid-cols-12 md:gap-x-2.5 md:gap-y-6">
          {STAGES.map((stage, i) => (
            <li key={stage.name} className="contents">
              <div
                {...("picture" in stage ? { "data-shutter": "" } : { "data-reveal": "" })}
                style={{ "--d": `${i * 90}ms` } as React.CSSProperties}
                className={cn("relative overflow-hidden md:row-start-1 md:self-end", stage.span, stage.tile)}
              >
                {"picture" in stage ? (
                  <Image
                    src={stage.picture.src}
                    alt={stage.picture.alt}
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-cover object-[50%_25%]"
                  />
                ) : (
                  <p className="flex h-full items-end p-5 text-lead md:p-7">&ldquo;{stage.quote}&rdquo;</p>
                )}
              </div>
              <div
                data-reveal
                style={{ "--d": `${120 + i * 90}ms` } as React.CSSProperties}
                className={cn("-mt-3 md:row-start-2 md:mt-0", stage.span)}
              >
                <h3 className="font-sans text-lead font-medium tracking-normal normal-case">{stage.name}</h3>
                <p className="mt-1 max-w-[36ch]">{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
