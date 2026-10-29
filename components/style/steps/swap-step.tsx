"use client";

import { FlowShell } from "@/components/style/flow-shell";
import { ProductImage } from "@/components/style/product-image";
import { showsInRender, type Look, type LookItem } from "@/lib/agent/events";
import { displayName } from "@/lib/catalog/names";
import { sgd } from "@/lib/utils/format";

export type SwapOptionsState = { status: "loading" | "done" | "error"; options: LookItem[]; error?: string };

const SLOT_NAMES: Record<LookItem["slot"], string> = {
  top: "top",
  outerwear: "layer",
  bottom: "trousers",
  shoes: "shoes",
  watch: "watch",
};

/** Only the garment on top shows in the try-on (see docs: YouCam framing limits). */
function priceDiff(next: number, current: number) {
  const d = Math.round(next - current);
  if (d === 0) return "Same price";
  return d > 0 ? `S$${d} more` : `S$${-d} less`;
}

/** Six alternatives for one piece of a look. Picking one swaps it in and tries the look on again. */
export function SwapStep({
  look,
  slot,
  state,
  onPick,
  onBack,
  onRetry,
}: {
  look: Look;
  slot: LookItem["slot"];
  state: SwapOptionsState;
  onPick: (option: LookItem) => void;
  onBack: () => void;
  onRetry: () => void;
}) {
  const current = look.items.find((i) => i.slot === slot)!;
  const name = SLOT_NAMES[slot];

  return (
    <FlowShell step={look.name}>
      <h1 className="mt-4 text-head">Swap the {name}</h1>
      <p className="mt-3">
        {showsInRender(look, slot)
          ? "Pick one and Wingman tries the look on you again."
          : `Pick one to update the look and its total. The ${name} show as a product card, not in the try-on.`}
      </p>

      <div className="mt-6 flex items-center gap-3 bg-surface p-2">
        <ProductImage src={current.image} sizes="64px" className="size-16" />
        <span className="min-w-0 flex-1">
          <span className="block text-small text-muted-foreground">Now · {current.storeName}</span>
          <a href={current.url} target="_blank" rel="noopener" className="text-link line-clamp-2 min-h-11 text-small">
            {displayName(current.name, current.storeName)}
          </a>
        </span>
        <span className="shrink-0 text-small tabular-nums">{sgd(current.price, { whole: true })}</span>
      </div>

      <h2 className="mt-10 text-lead">Alternatives</h2>
      {state.status === "loading" && (
        <p className="mt-4 text-muted-foreground" aria-live="polite">
          Finding {name} that go with the rest of the look…
        </p>
      )}
      {state.status === "error" && (
        <div className="mt-4">
          <p role="alert">{state.error}</p>
          <button type="button" onClick={onRetry} className="text-link mt-2 min-h-11">
            Try again
          </button>
        </div>
      )}
      {state.status === "done" && state.options.length === 0 && (
        <p className="mt-4">Nothing else in stock fits this look and budget right now.</p>
      )}

      {state.options.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {state.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => onPick(option)}
                className="group block w-full bg-surface text-left transition-colors hover:bg-surface-raised active:scale-[0.98]"
              >
                <ProductImage src={option.image} sizes="(min-width: 640px) 12rem, 45vw" className="aspect-square" />
                <span className="block p-3">
                  <span className="line-clamp-2 text-small">{displayName(option.name, option.storeName)}</span>
                  <span className="mt-1 block text-small text-muted-foreground">
                    <span className="capitalize">{option.colour}</span> · {option.storeName}
                  </span>
                  <span className="mt-1 block text-small tabular-nums">
                    {sgd(option.price, { whole: true })}{" "}
                    <span className="text-muted-foreground">({priceDiff(option.price, current.price)})</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onBack} className="text-link mt-10 min-h-11 text-muted-foreground">
        Keep the current {name}
      </button>
    </FlowShell>
  );
}
