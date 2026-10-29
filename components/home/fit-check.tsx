import Image from "next/image";
import { sgd } from "@/lib/utils/format";
import { FIT_CHECK } from "./looks-data";

/** A real Fit Check: the render, Wingman's score and reasoning, and the bill with its one-store checkout. */
export function FitCheck() {
  const total = FIT_CHECK.items.reduce((sum, i) => sum + i.price, 0);
  return (
    <section
      id="fit"
      aria-labelledby="fit-heading"
      className="relative z-10 grid gap-12 bg-background px-(--margin) py-28 md:grid-cols-12 md:gap-6 md:py-40"
    >
      <div data-shutter className="relative aspect-[4/5] overflow-hidden bg-surface md:col-span-5">
        <Image
          src={FIT_CHECK.render}
          alt="The model in a white linen shirt, the look this Fit Check scores"
          fill
          sizes="(min-width: 768px) 40vw, 100vw"
          className="object-cover object-[50%_30%]"
        />
      </div>

      <div className="flex flex-col md:col-span-6 md:col-start-7">
        <h2 id="fit-heading" data-reveal className="text-head">
          Fit check
        </h2>
        <p data-reveal style={{ "--d": "80ms" } as React.CSSProperties} className="mt-8 flex items-baseline gap-4">
          <span className="font-display text-display leading-none text-brass">{FIT_CHECK.score.toFixed(1)}</span>
          <span className="text-lead">out of 10</span>
        </p>
        <p data-reveal style={{ "--d": "160ms" } as React.CSSProperties} className="mt-6 max-w-[46ch] text-lead">
          {FIT_CHECK.reasoning}
        </p>

        <ul className="mt-12 flex flex-col gap-4 md:mt-auto md:pt-12">
          {FIT_CHECK.items.map((item, i) => (
            <li
              key={item.name}
              data-reveal
              style={{ "--d": `${200 + i * 70}ms` } as React.CSSProperties}
              className="flex items-baseline justify-between gap-6"
            >
              <span>{item.name}</span>
              <span className="shrink-0 tabular-nums">{sgd(item.price)}</span>
            </li>
          ))}
        </ul>
        <p
          data-reveal
          style={{ "--d": "420ms" } as React.CSSProperties}
          className="mt-6 flex items-baseline justify-between gap-6 bg-surface px-5 py-4 text-lead"
        >
          <span>Total, one store</span>
          <span className="tabular-nums">{sgd(total)}</span>
        </p>
        <div data-reveal style={{ "--d": "490ms" } as React.CSSProperties} className="mt-6">
          <a href={FIT_CHECK.cart} target="_blank" rel="noopener" className="btn w-full">
            Check out at {FIT_CHECK.store}
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </a>
          <p className="mt-3">Opens {FIT_CHECK.store}&apos;s own checkout with all three pieces in. You pay on their site.</p>
        </div>
      </div>
    </section>
  );
}
