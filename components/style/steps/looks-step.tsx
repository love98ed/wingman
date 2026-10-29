"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FlowShell, RAW_IMG_PROPS } from "@/components/style/flow-shell";
import { ProductImage } from "@/components/style/product-image";
import { RefineBar } from "@/components/style/refine-bar";
import type { Photo } from "@/components/style/style-flow";
import { showsInRender, type Look, type LookItem } from "@/lib/agent/events";
import type { ParsedOccasion } from "@/lib/agent/schemas";
import { isSoldOut, pieceCount, type CartLine } from "@/lib/cart";
import { displayName } from "@/lib/catalog/names";
import type { Tier } from "@/lib/catalog/types";
import { TIER_LABELS } from "@/lib/occasions";
import { cn } from "@/lib/utils/cn";
import { sgd } from "@/lib/utils/format";

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
  focusLook = 0,
  hasPrep,
  onPrep,
  onBrowse,
  onDeletePhoto,
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
  onSwap?: (index: number, slot: LookItem["slot"], cheaper?: boolean) => void;
  onRefine?: (message: string) => void;
  cart: CartLine[];
  onAddToCart: (look: Look) => void;
  onViewCart: () => void;
  /** The card to show first, e.g. the look a piece was just added to. */
  focusLook?: number;
  hasPrep: boolean;
  onPrep: () => void;
  onBrowse: () => void;
  onDeletePhoto: () => void;
}) {
  const inCart = new Set(cart.map((l) => l.id));
  const cartTotal = cart.filter((l) => !isSoldOut(l)).reduce((sum, l) => sum + l.price * l.qty, 0);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(focusLook);
  const wide = useWide();

  const goTo = (i: number, behavior: ScrollBehavior = "smooth") => {
    setActive(i);
    const card = track.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior, block: "nearest", inline: "center" });
  };
  const cardProps = (look: Look, i: number) => ({
    look,
    index: i,
    count: looks.length,
    photo,
    scoring: scoring && !look.fitCheck,
    onCompare: onCompare && (() => onCompare(i)),
    onSwap: onSwap && ((slot: LookItem["slot"]) => onSwap(i, slot)),
    onCheaper: onSwap && ((slot: LookItem["slot"]) => onSwap(i, slot, true)),
    inCart: look.items.every((item) => inCart.has(item.id)),
    onAddToCart: () => onAddToCart(look),
    onViewCart,
  });
  const shown = looks[Math.min(active, looks.length - 1)];

  // Coming back from Browse or Swap: land on the look that changed
  useEffect(() => {
    if (focusLook > 0 && !wide) goTo(focusLook, "instant");
    // Only on arrival, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FlowShell
      step={`${TIER_LABELS[tier]}${occasion ? `, ${occasion.setting}` : ""}`}
      wide
      back={{ label: "Back to the occasion", onClick: onRestart }}
    >
      <div className="max-w-xl">
        <h1 className="mt-2 text-head">{looks.length === 1 ? "Your look" : "Your looks"}</h1>
        <p className="mt-3">
          {looks.length === 1 ? "One look" : `${looks.length} looks`} from real Singapore stores, tried on your photo.{" "}
          {looks.length > 1 && <span className="lg:hidden">Swipe to compare them. </span>}
          To change a piece, open Additional.
        </p>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onViewCart}
            className="mt-4 flex min-h-12 w-full items-center justify-between bg-surface-raised px-4 text-left transition-colors hover:bg-surface"
          >
            <span>
              Cart: {pieceCount(cart)} {pieceCount(cart) === 1 ? "piece" : "pieces"},{" "}
              <span className="tabular-nums">{sgd(cartTotal)}</span>
            </span>
            <span className="font-medium">View cart</span>
          </button>
        )}
        {notice && (
          <p role="status" className="mt-4 bg-surface-raised p-4">
            {notice}
          </p>
        )}
      </div>

      {looks.length > 1 && (
        <LookSwitcher looks={looks} photo={photo} active={active} onChoose={(i) => (wide ? setActive(i) : goTo(i))} />
      )}

      {wide && shown ? (
        <div className="mt-6">
          <LookCard key={active} {...cardProps(shown, Math.min(active, looks.length - 1))} wide />
        </div>
      ) : (
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget;
            const width = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? el.clientWidth;
            setActive(Math.round(el.scrollLeft / (width + 16)));
          }}
          className="no-scrollbar -mx-(--margin) mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-(--margin) px-(--margin) md:mx-0 md:px-0"
          aria-label="Looks"
        >
          {looks.map((look, i) => (
            <LookCard key={i} {...cardProps(look, i)} />
          ))}
        </div>
      )}

      <div className="mt-10 flex max-w-xl flex-col items-start">
        <button type="button" onClick={onPrep} className="text-link min-h-11 font-medium">
          {hasPrep ? "Your night-before prep plan" : "Prep plan (on its way)"}
        </button>
        <button type="button" onClick={onBrowse} className="text-link min-h-11 font-medium">
          Browse every piece
        </button>
        <button type="button" onClick={onRestart} className="text-link min-h-11 text-muted-foreground">
          Change the occasion or budget
        </button>
        <button type="button" onClick={onDeletePhoto} className="text-link min-h-11 text-muted-foreground">
          Delete my photo
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
  onCheaper,
  inCart,
  onAddToCart,
  onViewCart,
  wide = false,
}: {
  /** Desktop: the one look on screen, try-on large on the left, details on the right. */
  wide?: boolean;
  look: Look;
  index: number;
  count: number;
  photo: Photo | null;
  scoring: boolean;
  onCompare?: () => void;
  onSwap?: (slot: LookItem["slot"]) => void;
  onCheaper?: (slot: LookItem["slot"]) => void;
  inCart: boolean;
  onAddToCart: () => void;
  onViewCart: () => void;
}) {
  const grooming = [
    look.renders.hair && { url: look.renders.hair, label: `Hair: ${look.hair}` },
    look.renders.beard && { url: look.renders.beard, label: `Beard: ${look.beard}` },
  ].filter(Boolean) as { url: string; label: string }[];
  const rendering = !look.renders.outfit && look.renders.errors.length === 0;
  const [tab, setTab] = useState<"look" | "additional">("look");
  const tabId = `look-${index}`;

  return (
    <article
      aria-label={`Look ${index + 1} of ${count}: ${look.name}`}
      className={cn(
        "relative flex shrink-0 flex-col bg-surface",
        wide ? "grid grid-cols-12" : "w-[86%] snap-center sm:w-[24rem]",
      )}
    >
      {/* Wide: the try-on stays in view while the details scroll beside it */}
      <div className={cn(wide && "sticky top-4 col-span-7 self-start")}>
        <div className="relative aspect-[4/5] overflow-hidden bg-surface-raised">
          {look.renders.outfit ? (
            <Image
              src={look.renders.outfit}
              alt={`You in ${look.name}`}
              fill
              sizes={wide ? "56vw" : "(min-width: 640px) 24rem, 86vw"}
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
              {look.renders.errors.includes("QUOTA")
                ? "Try-ons are paused for now, so here are the pieces on their own."
                : "The try-on didn't work for this one; the pieces are below."}
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

      </div>

      <div className={cn("flex flex-1 flex-col p-5", wide && "col-span-5 p-8")}>
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

        <div role="tablist" aria-label={`${look.name}: what to show`} className="mt-5 grid grid-cols-2 gap-1 bg-background/40 p-1">
          {(
            [
              ["look", "The look"],
              ["additional", "Additional"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${tabId}-${id}-tab`}
              aria-selected={tab === id}
              aria-controls={`${tabId}-${id}`}
              onClick={() => setTab(id)}
              className={cn("min-h-11 transition-colors", tab === id ? "bg-ivory text-background" : "hover:bg-surface-raised")}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "look" ? (
          <div role="tabpanel" id={`${tabId}-look`} aria-labelledby={`${tabId}-look-tab`}>
            {/* Score and label on one line, the reasoning full width below, so it reads at any width */}
            <div className="mt-5 bg-surface-raised p-4" aria-live="polite">
              {look.fitCheck ? (
                <>
                  <p className="flex items-baseline gap-3">
                    <span className="font-display text-head leading-none text-brass">{look.fitCheck.score.toFixed(1)}</span>
                    <span className="sr-only"> out of 10</span>
                    <span className="font-medium">Fit check</span>
                  </p>
                  <p className="mt-3">{look.fitCheck.reasoning}</p>
                </>
              ) : (
                <p className="text-small text-muted-foreground">{scoring ? "Scoring this look…" : "No score for this look."}</p>
              )}
            </div>

            <p className="mt-5">{look.why}</p>

            {/* Only the outer layer can be tried on (see the README): say which pieces are on you */}
            {(
              [
                ["In the try-on", look.items.filter((i) => showsInRender(look, i.slot))],
                ["Also in this look", look.items.filter((i) => !showsInRender(look, i.slot))],
              ] as const
            ).map(
              ([title, pieces]) =>
                pieces.length > 0 && (
                  <section key={title} className="mt-5">
                    <h3 className="subhead text-small text-muted-foreground">{title}</h3>
                    {title === "Also in this look" && (
                      <p className="mt-1 text-small text-muted-foreground">Picked for the outfit, not shown on you.</p>
                    )}
                    <ul className="mt-2 flex flex-col gap-3">
                      {pieces.map((item) => (
                        <PieceRow key={item.slot} item={item} />
                      ))}
                    </ul>
                  </section>
                ),
            )}
          </div>
        ) : (
          <div role="tabpanel" id={`${tabId}-additional`} aria-labelledby={`${tabId}-additional-tab`}>
            <section className="mt-5">
              <h3 className="subhead">Swap or save</h3>
              <p className="mt-1 text-small">
                Swap any piece for one of six in-stock alternatives, or see cheaper ones that go with the rest of the look.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {look.items.map((item) => (
                  <PieceRow key={item.slot} item={item} onSwap={onSwap} onCheaper={onCheaper} />
                ))}
              </ul>
            </section>
          </div>
        )}

        {/* Pinned to the bottom, so the buttons line up across cards of different lengths */}
        <div className="card-foot pt-5">
          {inCart ? (
            <button type="button" onClick={onViewCart} className="text-link min-h-11 font-medium">
              In your cart. View cart
            </button>
          ) : (
            <button type="button" onClick={onAddToCart} className="btn w-full">
              Add this look to cart
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** One piece of a look: photo, store, name and price linking to the store, and Swap and Cheaper buttons. */
function PieceRow({
  item,
  onSwap,
  onCheaper,
}: {
  item: LookItem;
  onSwap?: (slot: LookItem["slot"]) => void;
  onCheaper?: (slot: LookItem["slot"]) => void;
}) {
  return (
    <li className="flex items-center gap-3 bg-background/40 p-2">
      <a href={item.url} target="_blank" rel="noopener" className="group flex min-w-0 flex-1 items-center gap-3">
        <ProductImage src={item.image} sizes="64px" className="size-16" />
        <span className="min-w-0 flex-1">
          <span className="block text-small text-muted-foreground">
            {SLOT_LABELS[item.slot]} · {item.storeName}
          </span>
          <span className="line-clamp-2 text-small group-hover:underline">{displayName(item.name, item.storeName)}</span>
          <span className="block text-small tabular-nums">{sgd(item.price)}</span>
        </span>
      </a>
      {(onSwap || onCheaper) && (
        <span className="flex shrink-0 flex-col gap-1">
          {onSwap && (
            <button
              type="button"
              onClick={() => onSwap(item.slot)}
              aria-label={`Swap the ${SLOT_LABELS[item.slot].toLowerCase()}`}
              className="btn-quiet"
            >
              Swap
            </button>
          )}
          {onCheaper && (
            <button
              type="button"
              onClick={() => onCheaper(item.slot)}
              aria-label={`Cheaper ${SLOT_LABELS[item.slot].toLowerCase()} options`}
              className="btn-quiet"
            >
              Cheaper
            </button>
          )}
        </span>
      )}
    </li>
  );
}

/** True from 1024px up, where one look is shown large instead of a swipeable row. */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

/** One button per look: its try-on, name and score. Picks the look shown (or scrolls to it on a phone). */
function LookSwitcher({
  looks,
  photo,
  active,
  onChoose,
}: {
  looks: Look[];
  photo: Photo | null;
  active: number;
  onChoose: (index: number) => void;
}) {
  return (
    <div role="tablist" aria-label="Choose a look" className="mt-8 grid grid-cols-3 gap-1">
      {looks.map((look, i) => {
        const on = active === i;
        const picture = look.renders.outfit ?? photo?.url;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={`Look ${i + 1}: ${look.name}${look.fitCheck ? `, scored ${look.fitCheck.score.toFixed(1)}` : ""}`}
            onClick={() => onChoose(i)}
            className={cn(
              "flex min-h-11 items-center gap-2 p-1 text-left transition-colors sm:gap-3",
              on ? "bg-ivory text-background" : "bg-surface hover:bg-surface-raised",
            )}
          >
            <span className="relative hidden aspect-[4/5] w-10 shrink-0 overflow-hidden bg-surface-raised sm:block lg:w-12">
              {picture && <Image src={picture} alt="" fill sizes="48px" className="object-cover" {...RAW_IMG_PROPS} />}
            </span>
            <span className="min-w-0 flex-1 py-1 pl-1 sm:pl-0">
              <span className="line-clamp-1 text-small">{look.name}</span>
              <span className={cn("block text-small tabular-nums", !on && "text-muted-foreground")}>
                {look.fitCheck ? `${look.fitCheck.score.toFixed(1)} of 10` : "Scoring…"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
