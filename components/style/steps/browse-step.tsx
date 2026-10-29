"use client";

import { useEffect, useRef, useState } from "react";
import { FlowShell } from "@/components/style/flow-shell";
import { ProductImage } from "@/components/style/product-image";
import type { BrowseItem, BrowsePage, Look, LookItem } from "@/lib/agent/events";
import { displayName } from "@/lib/catalog/names";
import { TIERS } from "@/lib/catalog/types";
import { TIER_LABELS } from "@/lib/occasions";
import { cn } from "@/lib/utils/cn";
import { sgd } from "@/lib/utils/format";

export type BrowseFilters = {
  category: LookItem["slot"];
  tier?: string;
  price?: string;
  colour?: string;
  size?: string;
  store?: string;
  sort: "price-asc" | "price-desc";
};

const CATEGORIES: { value: LookItem["slot"]; label: string }[] = [
  { value: "top", label: "Tops" },
  { value: "outerwear", label: "Layers" },
  { value: "bottom", label: "Trousers" },
  { value: "shoes", label: "Shoes" },
  { value: "watch", label: "Watches" },
];

const PRICES = [
  { value: "under-100", label: "Under S$100" },
  { value: "100-250", label: "S$100 to 250" },
  { value: "250-500", label: "S$250 to 500" },
  { value: "over-500", label: "Over S$500" },
];

const SLOT_NAMES: Record<LookItem["slot"], string> = {
  top: "top",
  outerwear: "layer",
  bottom: "trousers",
  shoes: "shoes",
  watch: "watch",
};


/** One row of filter chips; tapping the chosen chip again clears it. */
function ChipRow({
  label,
  options,
  value,
  onChange,
  any = true,
}: {
  label: string;
  options: { value: string; label: string; count?: number }[];
  value?: string;
  onChange: (value?: string) => void;
  any?: boolean;
}) {
  return (
    // Fieldsets default to min-width: min-content, which would let the chip row widen the page
    <fieldset className="mt-5 min-w-0">
      <legend className="text-small font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="no-scrollbar -mx-(--margin) mt-2 flex gap-1 overflow-x-auto px-(--margin)">
        {any && (
          <Chip on={!value} onClick={() => onChange(undefined)}>
            Any
          </Chip>
        )}
        {options.map((o) => (
          <Chip key={o.value} on={value === o.value} onClick={() => onChange(value === o.value && any ? undefined : o.value)}>
            {o.label}
            {o.count != null && <span className="ml-1.5 tabular-nums opacity-60">{o.count}</span>}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 px-4 text-small whitespace-nowrap transition-colors",
        on ? "bg-ivory text-background" : "bg-surface hover:bg-surface-raised",
      )}
    >
      {children}
    </button>
  );
}

/** The whole in-stock catalog with filters. A piece can go into one of the looks or straight into the cart. */
export function BrowseStep({
  filters,
  onFilters,
  looks,
  inCart,
  onAddToLook,
  onAddToCart,
  onBack,
}: {
  filters: BrowseFilters;
  onFilters: (filters: BrowseFilters) => void;
  looks: Look[];
  inCart: Set<string>;
  onAddToLook: (look: number, item: BrowseItem) => void;
  onAddToCart: (item: BrowseItem) => void;
  onBack: () => void;
}) {
  const [page, setPage] = useState<BrowsePage | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<BrowseItem | null>(null);
  const key = JSON.stringify(filters);
  const loaded = useRef<string | null>(null);

  const query = (offset: number) => {
    const params = new URLSearchParams({ offset: String(offset) });
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    return `/api/browse?${params}`;
  };

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetch(query(0), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: BrowsePage) => {
        // Keep the old grid on screen while the next one loads, then swap
        setPage(data);
        setStatus("done");
        loaded.current = key;
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
    // `query` reads `filters`, which `key` stands for
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = async () => {
    if (!page) return;
    setMore(true);
    try {
      const res = await fetch(query(page.items.length));
      const next = (await res.json()) as BrowsePage;
      setPage((p) => (p ? { ...p, items: [...p.items, ...next.items] } : next));
    } finally {
      setMore(false);
    }
  };

  const set = (patch: Partial<BrowseFilters>) => onFilters({ ...filters, ...patch });
  const facets = page?.facets;

  return (
    <FlowShell step="Browse">
      <h1 className="mt-4 text-head">Browse</h1>
      <p className="mt-4">Every piece in stock at the stores Wingman shops. Tap one to add it to a look.</p>

      <ChipRow
        label="Category"
        any={false}
        options={CATEGORIES}
        value={filters.category}
        // A size or colour from one category rarely means anything in another
        onChange={(category) => category && onFilters({ category: category as BrowseFilters["category"], sort: filters.sort, tier: filters.tier, price: filters.price, store: filters.store })}
      />
      <ChipRow label="Budget" options={TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] }))} value={filters.tier} onChange={(tier) => set({ tier })} />
      <ChipRow label="Price" options={PRICES} value={filters.price} onChange={(price) => set({ price })} />
      <ChipRow
        label="Colour"
        options={(facets?.colours ?? []).map((c) => ({ value: c.value, label: c.value, count: c.count }))}
        value={filters.colour}
        onChange={(colour) => set({ colour })}
      />
      <ChipRow
        label="Size"
        options={(facets?.sizes ?? []).map((s) => ({ value: s.value, label: s.value, count: s.count }))}
        value={filters.size}
        onChange={(size) => set({ size })}
      />
      <ChipRow
        label="Store"
        options={(facets?.stores ?? []).map((s) => ({ value: s.value, label: s.label, count: s.count }))}
        value={filters.store}
        onChange={(store) => set({ store })}
      />

      <div className="mt-8 flex items-center justify-between gap-4" aria-live="polite">
        <p>
          {status === "error"
            ? "We couldn't load the catalog."
            : page && loaded.current === key
              ? `${page.total} ${page.total === 1 ? "piece" : "pieces"}`
              : "Loading…"}
        </p>
        <button
          type="button"
          onClick={() => set({ sort: filters.sort === "price-asc" ? "price-desc" : "price-asc" })}
          className="text-link min-h-11 text-small font-medium"
        >
          {filters.sort === "price-asc" ? "Price: low to high" : "Price: high to low"}
        </button>
      </div>

      {page && page.total === 0 && status === "done" && (
        <div className="mt-4">
          <p>Nothing matches all of those.</p>
          <button
            type="button"
            onClick={() => onFilters({ category: filters.category, sort: filters.sort })}
            className="text-link mt-1 min-h-11 font-medium"
          >
            Clear filters
          </button>
        </div>
      )}

      <ul className={cn("mt-4 grid grid-cols-2 gap-2 transition-opacity sm:grid-cols-3", status === "loading" && "opacity-50")}>
        {page?.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setSelected(item)}
              className="group block w-full bg-surface text-left transition-colors hover:bg-surface-raised active:scale-[0.98]"
            >
              <ProductImage src={item.image} sizes="(min-width: 640px) 12rem, 45vw" className="aspect-square" />
              <span className="block p-3">
                <span className="line-clamp-2 text-small">{displayName(item.name, item.storeName)}</span>
                <span className="mt-1 block text-small text-muted-foreground">{item.storeName}</span>
                <span className="mt-1 block text-small tabular-nums">{sgd(item.price, { whole: true })}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {page && page.items.length < page.total && (
        <button type="button" onClick={loadMore} disabled={more} className="mt-6 min-h-12 w-full bg-surface-raised transition-colors hover:bg-surface disabled:opacity-50">
          {more ? "Loading…" : `Show more (${page.total - page.items.length} left)`}
        </button>
      )}

      <button type="button" onClick={onBack} className="text-link mt-8 min-h-11 text-muted-foreground">
        Back to your looks
      </button>

      {selected && (
        <ItemSheet
          item={selected}
          looks={looks}
          inCart={inCart.has(selected.id)}
          onAddToLook={(i) => onAddToLook(i, selected)}
          onAddToCart={() => {
            onAddToCart(selected);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </FlowShell>
  );
}

/** Bottom sheet for one piece: details, which look to put it in, or the cart. */
function ItemSheet({
  item,
  looks,
  inCart,
  onAddToLook,
  onAddToCart,
  onClose,
}: {
  item: BrowseItem;
  looks: Look[];
  inCart: boolean;
  onAddToLook: (look: number) => void;
  onAddToCart: () => void;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const name = displayName(item.name, item.storeName);
  const slot = SLOT_NAMES[item.slot];

  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={name}>
      {/* Tapping outside closes; keyboard and screen readers use Escape or the Close button */}
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-background/80" />
      <div className="relative max-h-[88dvh] w-full max-w-xl animate-in overflow-y-auto bg-surface px-(--margin) pt-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] duration-300 slide-in-from-bottom-8">
        <div className="flex gap-4">
          <ProductImage src={item.image} sizes="112px" className="size-28" />
          <div className="min-w-0 flex-1">
            <h2 className="font-sans text-lead leading-snug font-medium tracking-normal normal-case">{name}</h2>
            <p className="mt-1 text-small text-muted-foreground">
              {item.storeName} · {TIER_LABELS[item.tier]} · <span className="capitalize">{item.colour}</span>
            </p>
            <p className="mt-1 tabular-nums">{sgd(item.price)}</p>
            <a href={item.url} target="_blank" rel="noopener" className="text-link mt-1 inline-flex min-h-11 items-center text-small">
              See it at {item.storeName}
            </a>
          </div>
        </div>

        {looks.length > 0 && (
          <>
            <p className="mt-6 font-medium">Put it in a look</p>
            <ul className="mt-2 flex flex-col gap-1">
              {looks.map((look, i) => {
                const current = look.items.find((it) => it.slot === item.slot);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onAddToLook(i)}
                      className="flex min-h-12 w-full flex-col justify-center bg-surface-raised px-4 py-2 text-left transition-colors hover:bg-background"
                    >
                      <span>{look.name}</span>
                      <span className="text-small text-muted-foreground">
                        {current
                          ? `Replaces the ${slot}: ${displayName(current.name, current.storeName)}`
                          : `Adds a ${slot}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {inCart ? (
            <p className="text-small text-muted-foreground">Already in your cart.</p>
          ) : (
            <button type="button" onClick={onAddToCart} className="btn w-full">
              Add to cart
            </button>
          )}
          <button ref={close} type="button" onClick={onClose} className="text-link min-h-11 text-muted-foreground">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
