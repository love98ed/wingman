import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { OCCASION_LOOKS } from "./looks-data";

/** The store's CDN resizes on request: the tiles show each piece far larger than a thumbnail. */
const CDN = "https://cdn.shopify.com/s/files/1/0092/1944/0718";
const SHIRT = OCCASION_LOOKS.date.piece;

/**
 * Three stages, each tile larger than the one before, so size carries the order. Each holds one
 * piece of the first-date look as Colony Clothing shows it (the Fit Check's bill), so the look
 * assembles from shoes to shirt. None of these pictures appears elsewhere on the page.
 */
const STAGES = [
  {
    name: "Snap one photo",
    body: "Waist up, facing the camera. Glasses are fine. Your try-ons are deleted after 24 hours.",
    span: "md:col-span-3",
    tile: "h-[34vw] md:h-[30vh] bg-product",
    piece: {
      name: "Paraboot Coraux",
      url: "https://colonyclothing.net/products/paraboot-coraux-lis-noir-black",
      image: `${CDN}/files/image_f9df95bd-bfaf-4347-b380-46cd58b1dbda.png?v=1764818593&width=1200`,
      fit: "scale-[1.2] group-hover:scale-[1.26] object-cover object-[50%_55%]",
    },
  },
  {
    name: "Say where you're going",
    body: "“First date Friday night, rooftop bar” and a budget. Wingman picks in-stock pieces from local stores.",
    span: "md:col-span-4",
    tile: "h-[46vw] md:h-[44vh] bg-brass",
    piece: {
      name: "Baker Pants in black",
      url: "https://colonyclothing.net/products/8-54701-51",
      image: `${CDN}/files/DSC05118.webp?v=1764809712&width=1400`,
      fit: "scale-[1.3] group-hover:scale-[1.36] object-cover object-[50%_40%]",
    },
  },
  {
    name: "Wear it, buy it",
    body: "Each look on you with a Fit Check, and one cart per store.",
    span: "md:col-span-5",
    tile: "h-[62vw] md:h-[60vh] bg-product",
    piece: {
      name: SHIRT.name,
      url: SHIRT.url,
      image: SHIRT.thumb.replace("width=600", "width=1600"),
      fit: "scale-[1.45] group-hover:scale-[1.52] object-cover object-[50%_35%]",
    },
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
              {/* Each piece is shown larger than its tile so the edges crop it; multiply drops the
                  store's white backdrop into the tile's ground */}
              <div
                data-shutter=""
                style={{ "--d": `${i * 90}ms` } as React.CSSProperties}
                className={cn("relative overflow-hidden md:row-start-1 md:self-end", stage.span, stage.tile)}
              >
                <a href={stage.piece.url} target="_blank" rel="noopener" aria-label={`${stage.piece.name}, Colony Clothing`} className="group absolute inset-0">
                  <Image
                    src={stage.piece.image}
                    alt={`${stage.piece.name} from Colony Clothing`}
                    fill
                    sizes={i === 2 ? "(min-width: 768px) 60vw, 100vw" : "(min-width: 768px) 40vw, 100vw"}
                    className={cn(
                      "mix-blend-multiply transition-transform duration-700 ease-(--ease-out)",
                      stage.piece.fit,
                    )}
                  />
                </a>
              </div>
              <div
                data-reveal
                style={{ "--d": `${120 + i * 90}ms` } as React.CSSProperties}
                className={cn("-mt-3 md:row-start-2 md:mt-0", stage.span)}
              >
                <h3 className="subhead">{stage.name}</h3>
                <p className="mt-1 max-w-[36ch]">{stage.body}</p>
                <a href={stage.piece.url} target="_blank" rel="noopener" className="text-link mt-2 inline-block text-small text-muted-foreground">
                  {stage.piece.name}, Colony Clothing
                </a>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
