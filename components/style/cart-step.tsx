"use client";

import Image from "next/image";
import { groupByStore, isOneSize, type CartLine } from "@/lib/cart";
import { displayName } from "@/lib/catalog/names";
import { cn } from "@/lib/utils";
import { FlowShell, RAW_IMG_PROPS } from "./flow-shell";

const sgd = (n: number) => `S$${n.toFixed(2)}`;

/** Items grouped by store, an in-stock size picker per item, and one checkout per store. */
export function CartStep({
  lines,
  onSize,
  onRemove,
  onBack,
}: {
  lines: CartLine[];
  onSize: (id: string, variantId: number) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
}) {
  const stores = groupByStore(lines);
  const total = stores.reduce((sum, s) => sum + s.subtotal, 0);

  return (
    <FlowShell step="Cart">
      <h1 className="mt-4 text-head">Your cart</h1>
      {lines.length === 0 ? (
        <p className="mt-4">Nothing here yet. Add a look from your looks.</p>
      ) : (
        <p className="mt-4">
          {lines.length} {lines.length === 1 ? "piece" : "pieces"} from {stores.length} {stores.length === 1 ? "store" : "stores"},{" "}
          <span className="tabular-nums">{sgd(total)}</span>. Pick your sizes, then check out at each store; its cart
          opens with your pieces in it.
        </p>
      )}

      {stores.map((group) => {
        const missing = group.lines.filter((l) => l.variantId == null).length;
        return (
          <section key={group.store} aria-labelledby={`store-${group.store}`} className="mt-10">
            <h2 id={`store-${group.store}`} className="text-lead">
              {group.storeName}
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {group.lines.map((line) => (
                <CartItem key={line.id} line={line} onSize={onSize} onRemove={onRemove} />
              ))}
            </ul>
            <p className="mt-4 flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{sgd(group.subtotal)}</span>
            </p>
            {group.checkoutUrl ? (
              <a href={group.checkoutUrl} target="_blank" rel="noopener" className="btn mt-3 w-full">
                Checkout at {group.storeName}
              </a>
            ) : (
              <button type="button" disabled className="btn mt-3 w-full opacity-50">
                Pick {missing === 1 ? "a size" : `${missing} sizes`} to check out
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

      <button type="button" onClick={onBack} className="text-link mt-6 min-h-11 text-muted-foreground">
        Back to your looks
      </button>
    </FlowShell>
  );
}

function CartItem({
  line,
  onSize,
  onRemove,
}: {
  line: CartLine;
  onSize: (id: string, variantId: number) => void;
  onRemove: (id: string) => void;
}) {
  const name = displayName(line.name, line.storeName);
  return (
    <li className="bg-surface p-3">
      <div className="flex gap-3">
        <span className="relative size-20 shrink-0 overflow-hidden bg-[#d9d7d2]">
          <Image src={line.image} alt="" fill sizes="80px" className="object-cover" {...RAW_IMG_PROPS} />
        </span>
        <div className="min-w-0 flex-1">
          <a href={line.url} target="_blank" rel="noopener" className="text-link line-clamp-2">
            {name}
          </a>
          <p className="mt-1 tabular-nums">{sgd(line.price)}</p>
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
        <p className="mt-3 text-small">Sold out. Remove it or swap it from your looks.</p>
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
    </li>
  );
}
