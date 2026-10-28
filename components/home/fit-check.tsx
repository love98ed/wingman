/** The sample look's Fit Check and bill, set as a plain list of facts. */
const ITEMS = [
  { slot: "Camp collar shirt, size XL", price: 136.25 },
  { slot: "Basic pants in dark grey, size M", price: 158.05 },
  { slot: "Slick back haircut", price: 0 },
];

// Shopify cart permalink for the two in-stock variants above
const CART = "https://duxton.com/cart/42831543140552:1,44241014685896:1";

const SCORE = 8.6;

const sgd = (n: number) => `S$${n.toFixed(2)}`;

export function FitCheck() {
  const total = ITEMS.reduce((sum, i) => sum + i.price, 0);
  return (
    <section
      id="fit"
      aria-labelledby="fit-heading"
      className="relative z-10 grid gap-14 bg-surface px-(--margin) py-28 md:grid-cols-12 md:gap-6 md:py-44"
    >
      <div className="md:col-span-5">
        <h2 id="fit-heading" data-reveal className="text-head">
          Fit check
        </h2>
        <p data-reveal style={{ "--d": "80ms" } as React.CSSProperties} className="mt-8 flex items-baseline gap-4">
          <span className="font-display text-display leading-none text-brass">{SCORE.toFixed(1)}</span>
          <span className="text-lead">out of 10</span>
        </p>
        <p data-reveal style={{ "--d": "160ms" } as React.CSSProperties} className="mt-6 max-w-[38ch] text-lead">
          The warm olive print lifts your skin tone, and the open collar keeps it relaxed enough for a rooftop bar.
        </p>
      </div>

      <div className="md:col-span-6 md:col-start-7 md:self-end">
        <ul className="flex flex-col gap-5">
          {ITEMS.map((item, i) => (
            <li
              key={item.slot}
              data-reveal
              style={{ "--d": `${200 + i * 70}ms` } as React.CSSProperties}
              className="flex items-baseline justify-between gap-6"
            >
              <span>{item.slot}</span>
              <span className="shrink-0 tabular-nums">{item.price ? sgd(item.price) : "Free"}</span>
            </li>
          ))}
        </ul>
        <p
          data-reveal
          style={{ "--d": "420ms" } as React.CSSProperties}
          className="mt-8 flex items-baseline justify-between gap-6 bg-surface-raised px-5 py-4 text-lead"
        >
          <span>Total, one store</span>
          <span className="tabular-nums">{sgd(total)}</span>
        </p>
        <div data-reveal style={{ "--d": "490ms" } as React.CSSProperties} className="mt-6">
          <a href={CART} target="_blank" rel="noopener" className="btn w-full">
            Check out at DUXTON
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </a>
          <p className="mt-3">
            Opens DUXTON&apos;s cart with both pieces in your sizes. You pay on their site.
          </p>
        </div>
      </div>
    </section>
  );
}
