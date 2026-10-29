"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Look, LookItem } from "@/lib/agent/events";
import type { CartLine } from "@/lib/cart";
import type { ParsedOccasion } from "@/lib/agent/schemas";
import type { Tier } from "@/lib/catalog/types";
import { displayName } from "@/lib/catalog/names";
import { TIER_LABELS } from "@/lib/occasions";
import { cn } from "@/lib/utils";
import { FlowShell, RAW_IMG_PROPS } from "./flow-shell";
import { RefineBar } from "./refine-bar";
import type { Photo } from "./style-flow";

const sgd = (n: number) => `S$${n.toFixed(2)}`;

const SLOT_LABELS: Record<LookItem["slot"], string> = {
  top: "Top",
  outerwear: "Layer",
  bottom: "Bottom",
  shoes: "Shoes",
  watch: "Watch",
};

/** Swipeable look cards. Renders and Fit Checks fill in as they stream. */
export function LooksStep({
  looks,
  photo,
  occasion,
  tier,
  scoring,
  notice,
  onRestart,
  onCompare,
  onSwap,
  onRefine,
  cart,
  onAddToCart,
  onViewCart,
}: {
  looks: Look[];
  photo: Photo | null;
  occasion: ParsedOccasion | null;
  tier: Tier;
  scoring: boolean;
  /** A refine or swap that didn't work; the looks on screen are unchanged. */
  notice: string | null;
  onRestart: () => void;
  /** Opens Price Compare for a look; absent until the looks are picked. */
  onCompare?: (index: number) => void;
  onSwap?: (index: number, slot: LookItem["slot"]) => void;
  onRefine?: (message: string) => void;
  cart: CartLine[];
  onAddToCart: (look: Look) => void;
  onViewCart: () => void;
}) {
  const inCart = new Set(cart.map((l) => l.id));
  const cartTotal = cart.reduce((sum, l) => sum + l.price * l.qty, 0);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = (i: number) => {
    const card = track.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  return (
    <FlowShell step={`${TIER_LABELS[tier]}${occasion ? `, ${occasion.setting}` : ""}`} wide>
      <div className="mx-auto max-w-xl">
        <h1 className="mt-4 text-head">Your looks</h1>
        <p className="mt-3">
          {looks.length} looks from real Singapore stores, tried on your photo. Swipe to compare, tap Swap to change a piece.
        </p>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onViewCart}
            className="mt-4 flex min-h-12 w-full items-center justify-between bg-surface-raised px-4 text-left transition-colors hover:bg-surface"
          >
            <span>
              Cart: {cart.length} {cart.length === 1 ? "piece" : "pieces"},{" "}
              <span className="tabular-nums">{sgd(cartTotal)}</span>
            </span>
            <span className="font-medium">View cart</span>
          </button>
        )}
        {notice && (
          <p role="alert" className="mt-4 bg-surface-raised p-4">
            {notice}
          </p>
        )}
      </div>

      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const width = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? el.clientWidth;
          setActive(Math.round(el.scrollLeft / (width + 16)));
        }}
        className="no-scrollbar -mx-(--margin) mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-(--margin) px-(--margin) md:mx-0 md:px-0"
        aria-label="Looks"
      >
        {looks.map((look, i) => (
          <LookCard
            key={i}
            look={look}
            index={i}
            count={looks.length}
            photo={photo}
            scoring={scoring && !look.fitCheck}
            onCompare={onCompare && (() => onCompare(i))}
            onSwap={onSwap && ((slot) => onSwap(i, slot))}
            inCart={look.items.every((item) => inCart.has(item.id))}
            onAddToCart={() => onAddToCart(look)}
            onViewCart={onViewCart}
          />
        ))}
      </div>

      {looks.length > 1 && (
        <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label="Choose a look">
          {looks.map((look, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={`Look ${i + 1}: ${look.name}`}
              onClick={() => goTo(i)}
              className="grid size-11 place-items-center"
            >
              <span className={cn("h-1 transition-all", active === i ? "w-8 bg-brass" : "w-4 bg-surface-raised")} />
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto mt-10 max-w-xl">
        <button type="button" onClick={onRestart} className="text-link min-h-11 text-muted-foreground">
          Change the occasion or budget
        </button>
      </div>

      {onRefine && <RefineBar onRefine={onRefine} />}
    </FlowShell>
  );
}

function LookCard({
  look,
  index,
  count,
  photo,
  scoring,
  onCompare,
  onSwap,
  inCart,
  onAddToCart,
  onViewCart,
}: {
  look: Look;
  index: number;
  count: number;
  photo: Photo | null;
  scoring: boolean;
  onCompare?: () => void;
  onSwap?: (slot: LookItem["slot"]) => void;
  inCart: boolean;
  onAddToCart: () => void;
  onViewCart: () => void;
}) {
  const grooming = [
    look.renders.hair && { url: look.renders.hair, label: `Hair: ${look.hair}` },
    look.renders.beard && { url: look.renders.beard, label: `Beard: ${look.beard}` },
  ].filter(Boolean) as { url: string; label: string }[];
  const rendering = !look.renders.outfit && look.renders.errors.length === 0;

  return (
    <article
      aria-label={`Look ${index + 1} of ${count}: ${look.name}`}
      className="relative w-[86%] shrink-0 snap-center bg-surface sm:w-[24rem]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-raised">
        {look.renders.outfit ? (
          <Image
            src={look.renders.outfit}
            alt={`You in ${look.name}`}
            fill
            sizes="(min-width: 640px) 24rem, 86vw"
            className="animate-in object-cover fade-in duration-500"
            {...RAW_IMG_PROPS}
          />
        ) : (
          photo && (
            <Image src={photo.url} alt="Your photo" fill sizes="24rem" className="object-cover opacity-40" {...RAW_IMG_PROPS} />
          )
        )}
        {rendering && (
          <p className="absolute inset-x-0 bottom-0 bg-background/80 px-4 py-3 text-small">Trying this look on you…</p>
        )}
        {!look.renders.outfit && !rendering && (
          <p className="absolute inset-x-0 bottom-0 bg-background/80 px-4 py-3 text-small">
            The try-on didn&apos;t work for this one; the pieces are below.
          </p>
        )}
      </div>

      {grooming.length > 0 && (
        <div className="grid grid-cols-2 gap-1 p-1">
          {grooming.map((g) => (
            <figure key={g.label} className="relative">
              <div className="relative aspect-square overflow-hidden bg-surface-raised">
                <Image src={g.url} alt={g.label} fill sizes="12rem" className="object-cover" {...RAW_IMG_PROPS} />
              </div>
              <figcaption className="px-2 py-1.5 text-small">{g.label}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="p-5">
        {/* The display face is wide: the name gets its own line and shrinks a little on very
            narrow phones so a long word ("Professional") still fits whole */}
        <h2 className="text-[min(var(--step-lead),5vw)] [overflow-wrap:break-word]">{look.name}</h2>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
          <p className="whitespace-nowrap">
            <span className="tabular-nums">{sgd(look.total)}</span>
            <span className="text-small text-muted-foreground"> · {TIER_LABELS[look.tier]}</span>
          </p>
          {onCompare && (
            <button type="button" onClick={onCompare} className="text-link -my-3 min-h-11 text-small font-medium whitespace-nowrap">
              Compare prices
            </button>
          )}
        </div>

        <div className="mt-5 flex gap-4 bg-surface-raised p-4" aria-live="polite">
          {look.fitCheck ? (
            <>
              <p className="shrink-0">
                <span className="font-display text-head leading-none text-brass">{look.fitCheck.score.toFixed(1)}</span>
                <span className="sr-only"> out of 10</span>
              </p>
              <div>
                <p className="font-medium">Fit check</p>
                <p className="mt-1 text-small">{look.fitCheck.reasoning}</p>
              </div>
            </>
          ) : (
            <p className="text-small text-muted-foreground">{scoring ? "Scoring this look…" : "No score for this look."}</p>
          )}
        </div>

        <p className="mt-5">{look.why}</p>

        <ul className="mt-5 flex flex-col gap-3">
          {look.items.map((item) => (
            <li key={item.slot} className="flex items-center gap-3 bg-background/40 p-2">
              <a href={item.url} target="_blank" rel="noopener" className="group flex min-w-0 flex-1 items-center gap-3">
                <span className="relative size-16 shrink-0 overflow-hidden bg-[#d9d7d2]">
                  <Image src={item.image} alt="" fill sizes="64px" className="object-cover" {...RAW_IMG_PROPS} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-small text-muted-foreground">
                    {SLOT_LABELS[item.slot]} · {item.storeName}
                  </span>
                  <span className="line-clamp-2 text-small group-hover:underline">{displayName(item.name, item.storeName)}</span>
                  <span className="block text-small tabular-nums">{sgd(item.price)}</span>
                </span>
              </a>
              {onSwap && (
                <button
                  type="button"
                  onClick={() => onSwap(item.slot)}
                  aria-label={`Swap the ${SLOT_LABELS[item.slot].toLowerCase()}`}
                  className="min-h-11 shrink-0 bg-surface-raised px-3 text-small font-medium transition-colors hover:bg-surface active:scale-[0.97]"
                >
                  Swap
                </button>
              )}
            </li>
          ))}
        </ul>

        {inCart ? (
          <button type="button" onClick={onViewCart} className="text-link mt-5 min-h-11 font-medium">
            In your cart. View cart
          </button>
        ) : (
          <button type="button" onClick={onAddToCart} className="btn mt-5 w-full">
            Add this look to cart
          </button>
        )}
      </div>
    </article>
  );
}
