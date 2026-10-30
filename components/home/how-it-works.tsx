import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { OCCASION_LOOKS } from "./looks-data";

/** The shirt from the first-date look, as its store shows it: no other section uses this picture. */
const SHIRT = OCCASION_LOOKS.date.piece;
/** The store's CDN resizes on request: the tile shows the shirt far larger than the picker's thumbnail. */
const SHIRT_LARGE = SHIRT.thumb.replace("width=600", "width=1600");

/** Three stages, each tile larger than the one before, so size carries the order. */
const STAGES = [
  {
    name: "Snap one photo",
    body: "Waist up, facing the camera. Your try-ons are deleted after 24 hours.",
    span: "md:col-span-3",
    tile: "h-[34vw] md:h-[30vh] bg-surface-raised",
    text: "One photo. Glasses are fine.",
  },
  {
    name: "Say where you're going",
    body: "One sentence and a budget. Wingman picks in-stock pieces from local stores.",
    span: "md:col-span-4",
    tile: "h-[46vw] md:h-[44vh] bg-brass text-background",
    text: "\u201CFirst date Friday night, rooftop bar, mid-range.\u201D",
  },
  {
    name: "Wear it, buy it",
    body: "Each look on you with a Fit Check, and one cart per store.",
    span: "md:col-span-5",
    tile: "h-[62vw] md:h-[60vh] bg-product",
    piece: SHIRT,
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
              {/* Type, and one store photo: the page's try-ons each appear once, in the sections above */}
              <div
                {...("piece" in stage ? { "data-shutter": "" } : { "data-reveal": "" })}
                style={{ "--d": `${i * 90}ms` } as React.CSSProperties}
                className={cn("relative overflow-hidden md:row-start-1 md:self-end", stage.span, stage.tile)}
              >
                {"piece" in stage ? (
                  // Shown larger than the tile so its edges crop the shirt; multiply drops the store's
                  // white backdrop into the tile's ground
                  <a href={stage.piece.url} target="_blank" rel="noopener" aria-label={`${stage.piece.name}, ${stage.piece.store}`} className="group absolute inset-0">
                    <Image
                      src={SHIRT_LARGE}
                      alt={`${stage.piece.name} from ${stage.piece.store}`}
                      fill
                      sizes="(min-width: 768px) 60vw, 100vw"
                      className="scale-[1.45] object-cover object-[50%_35%] mix-blend-multiply transition-transform duration-700 ease-(--ease-out) group-hover:scale-[1.52]"
                    />
                  </a>
                ) : (
                  <p className="flex h-full items-end p-5 text-lead md:p-7">{stage.text}</p>
                )}
              </div>
              <div
                data-reveal
                style={{ "--d": `${120 + i * 90}ms` } as React.CSSProperties}
                className={cn("-mt-3 md:row-start-2 md:mt-0", stage.span)}
              >
                <h3 className="subhead">{stage.name}</h3>
                <p className="mt-1 max-w-[36ch]">{stage.body}</p>
                {"piece" in stage && (
                  <a href={stage.piece.url} target="_blank" rel="noopener" className="text-link mt-2 inline-block text-small text-muted-foreground">
                    {stage.piece.name}, {stage.piece.store}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
