"use client";

import { FlowShell } from "@/components/style/flow-shell";
import { ProductImage } from "@/components/style/product-image";
import { useState } from "react";
import { groupByStore, isOneSize, isSoldOut, MAX_QTY, pieceCount, type CartLine } from "@/lib/cart";
import { displayName } from "@/lib/catalog/names";
import { cn } from "@/lib/utils/cn";
import { sgd } from "@/lib/utils/format";

/** Items grouped by store, an in-stock size picker per item, and one checkout per store. */
export function CartStep({
  lines,
  onSize,
  onQty,
  onRemove,
  onRestore,
  onBack,
  backLabel = "Back to your looks",
}: {
  lines: CartLine[];
  onSize: (id: string, variantId: number) => void;
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  /** Put a removed line back where it was. */
  onRestore: (line: CartLine, index: number) => void;
  onBack: () => void;
  /** Names the screen the back button returns to. */
  backLabel?: string;
}) {
  const stores = groupByStore(lines);
  const total = stores.reduce((sum, s) => sum + s.subtotal, 0);
  const count = pieceCount(lines.filter((l) => !isSoldOut(l)));
  /** The last piece removed, so one tap can bring it back. */
  const [removed, setRemoved] = useState<{ line: CartLine; index: number } | null>(null);
  const remove = (id: string) => {
    const index = lines.findIndex((l) => l.id === id);
    if (index >= 0) setRemoved({ line: lines[index], index });
    onRemove(id);
  };

  return (
    <FlowShell step="Cart">
      <h1 className="mt-4 text-head">Your cart</h1>
      {lines.length === 0 ? (
        <>
          <p className="mt-4">Your cart is empty. Add a whole look, or single pieces while you browse.</p>
          <button type="button" onClick={onBack} className="btn mt-8 w-full">
            {backLabel}
          </button>
        </>
      ) : (
        <p className="mt-4">
          {count} {count === 1 ? "piece" : "pieces"} from {stores.length} {stores.length === 1 ? "store" : "stores"},{" "}
          <span className="tabular-nums">{sgd(total)}</span>. Pick your sizes, then check out at each store; its cart
          opens with your pieces in it.
        </p>
      )}

      {removed && (
        <p role="status" className="mt-6 flex items-center justify-between gap-4 bg-surface-raised py-1 pr-1 pl-4">
          <span className="min-w-0 truncate">Removed {displayName(removed.line.name, removed.line.storeName)}</span>
          <button
            type="button"
            onClick={() => {
              onRestore(removed.line, removed.index);
              setRemoved(null);
            }}
            className="min-h-11 shrink-0 px-3 font-medium text-link"
          >
            Undo
          </button>
        </p>
      )}

      {stores.map((group) => {
        const missing = group.missingSizes;
        return (
          <section key={group.store} aria-labelledby={`store-${group.store}`} className="mt-10">
            <h2 id={`store-${group.store}`} className="text-lead">
              {group.storeName}
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {group.lines.map((line) => (
                <CartItem key={line.id} line={line} onSize={onSize} onQty={onQty} onRemove={remove} />
              ))}
            </ul>
            <p className="mt-4 flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{sgd(group.subtotal)}</span>
            </p>
            {group.checkoutUrl ? (
              <a href={group.checkoutUrl} target="_blank" rel="noopener" className="btn mt-3 w-full">
                Check out at {group.storeName}
                <span className="sr-only"> (opens the store&apos;s site)</span>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            ) : (
              <button type="button" disabled className="btn mt-3 w-full opacity-50">
                {missing > 0 ? `Pick ${missing === 1 ? "a size" : `${missing} sizes`} to check out` : "Nothing here can be bought now"}
              </button>
            )}
          </section>
        );
      })}

      {lines.length > 0 && (
        <p className="mt-10 text-small text-muted-foreground">
          You pay at each store&apos;s own checkout. Prices here are in SGD; a store that charges in another currency
          shows its own price.
        </p>
      )}

      {lines.length > 0 && (
        <button type="button" onClick={onBack} className="text-link mt-6 min-h-11 text-muted-foreground">
          {backLabel}
        </button>
      )}
    </FlowShell>
  );
}

function CartItem({
  line,
  onSize,
  onQty,
  onRemove,
}: {
  line: CartLine;
  onSize: (id: string, variantId: number) => void;
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const name = displayName(line.name, line.storeName);
  return (
    <li className="bg-surface p-3">
      <div className="flex gap-3">
        <ProductImage src={line.image} sizes="80px" className="size-20" />
        <div className="min-w-0 flex-1">
          <a href={line.url} target="_blank" rel="noopener" className="text-link line-clamp-2 min-h-11">
            {name}
          </a>
          <p className="mt-1 tabular-nums">
            {sgd(line.price)}
            {line.qty > 1 && <span className="text-muted-foreground"> each, {sgd(line.price * line.qty)} for {line.qty}</span>}
          </p>
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            className="text-link -my-2 min-h-11 text-small text-muted-foreground"
            aria-label={`Remove ${name}`}
          >
            Remove
          </button>
        </div>
      </div>

      {line.sizes.length === 0 ? (
        <p className="mt-3 text-small">Sold out, so it&apos;s left out of the total and checkout. Remove it, or swap it from your looks.</p>
      ) : isOneSize(line.sizes) ? (
        <p className="mt-3 text-small text-muted-foreground">One size</p>
      ) : (
        <div role="radiogroup" aria-label={`Size for ${name}`} className="mt-3 flex flex-wrap gap-1">
          {line.sizes.map((s) => {
            const on = line.variantId === s.variantId;
            return (
              <button
                key={s.variantId}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onSize(line.id, s.variantId)}
                className={cn(
                  "min-h-11 min-w-11 px-3 text-small transition-colors",
                  on ? "bg-ivory text-background" : "bg-surface-raised hover:bg-background",
                )}
              >
                {s.size}
              </button>
            );
          })}
        </div>
      )}

      {!isSoldOut(line) && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-small text-muted-foreground" id={`qty-${line.id}`}>
            Quantity
          </span>
          <div role="group" aria-labelledby={`qty-${line.id}`} className="flex items-center bg-surface-raised">
            <button
              type="button"
              onClick={() => (line.qty <= 1 ? onRemove(line.id) : onQty(line.id, line.qty - 1))}
              aria-label={line.qty <= 1 ? `Remove ${name}` : `One fewer ${name}`}
              className="grid size-11 place-items-center transition-colors hover:bg-background disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M5 12h14" />
              </svg>
            </button>
            <span aria-live="polite" className="min-w-8 text-center tabular-nums">
              {line.qty}
            </span>
            <button
              type="button"
              onClick={() => onQty(line.id, line.qty + 1)}
              disabled={line.qty >= MAX_QTY}
              aria-label={`One more ${name}`}
              className="grid size-11 place-items-center transition-colors hover:bg-background disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
