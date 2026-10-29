import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** The sample look, piece by piece: a full-bleed close-up of the render with one card per piece. */
const PIECES = [
  {
    id: "shirt",
    name: "Camp collar shirt",
    detail: "Retro Spade print, regular fit",
    price: "S$136.25 at DUXTON",
    image: "https://cdn.shopify.com/s/files/1/0098/6198/8414/files/RegularFitCampShirt-RetroSpade_Front.png?v=1690795890",
    imageAlt: "Camp collar shirt in the Retro Spade print, on a model",
    href: "https://duxton.com/products/regular-fit-camp-shirt-retro-spade",
    action: "See it at DUXTON",
    // Close on the shirt's print
    crop: "object-[50%_88%]",
    zoom: "scale-[1.35] origin-[50%_85%]",
    col: "md:col-start-3",
  },
  {
    id: "hair",
    name: "Modern slick back",
    detail: "Tried on your photo with the hair try-on",
    price: "Show it to your barber",
    image: "/demo/after.jpg",
    imageAlt: "The full styled look with the slick back",
    href: "/style",
    action: "Try a cut on you",
    // Close on the hair and face
    crop: "object-[50%_12%]",
    zoom: "scale-[1.3] origin-[50%_18%]",
    col: "md:col-start-4",
  },
] as const;

export function LookFrames({ render }: { render: string }) {
  return (
    <section id="look" aria-label="The look" className="relative z-10 bg-background">
      {PIECES.map((piece, i) => (
        <div key={piece.id} className="relative h-svh min-h-[36rem] overflow-hidden">
          <div className={cn("absolute inset-0", piece.zoom)}>
            <Image
              src={render}
              alt={i === 0 ? "Close-up of the styled render: the camp collar shirt" : "Close-up of the styled render: the slick back"}
              fill
              sizes="100vw"
              className={cn("object-cover", piece.crop)}
            />
          </div>

          <div className="absolute inset-x-0 bottom-0 md:inset-0 md:grid md:grid-cols-4 md:items-center md:gap-6 md:px-(--margin)">
            <article
              data-reveal
              className={cn(
                "flex h-[46svh] min-h-[22rem] flex-col bg-ivory p-5 text-background md:col-span-1 md:h-[52svh] md:min-h-[30rem] md:items-center md:p-6 md:text-center",
                piece.col,
              )}
            >
              <div className="flex gap-4 md:contents">
                <div className="min-w-0 flex-1 md:order-1 md:flex-none">
                  {i === 0 ? (
                    <h2 className="text-lead">{piece.name}</h2>
                  ) : (
                    <h3 className="text-lead">{piece.name}</h3>
                  )}
                  <p className="mt-3">{piece.detail}</p>
                  <p className="font-medium">{piece.price}</p>
                </div>
                <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-[#d9d7d2] md:order-2 md:mt-auto md:aspect-[3/2] md:w-full">
                  <Image src={piece.image} alt={piece.imageAlt} fill sizes="(min-width: 768px) 22vw, 96px" className="object-cover object-[50%_30%]" />
                </div>
              </div>
              <a
                href={piece.href}
                {...(piece.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}
                className="btn mt-auto w-full md:order-3 md:mt-5"
              >
                {piece.action}
              </a>
            </article>
          </div>
        </div>
      ))}
    </section>
  );
}
