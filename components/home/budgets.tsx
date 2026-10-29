import Image from "next/image";
import Link from "next/link";
import { sgd } from "@/lib/utils/format";
import { BUDGETS } from "./looks-data";

/** Price Compare, shown with real output: the same white linen look at each budget, edge to edge. */
export function Budgets() {
  return (
    <section id="budgets" aria-labelledby="budgets-heading" className="relative z-10 bg-surface pt-28 pb-24 md:pt-40 md:pb-32">
      <div className="grid gap-6 px-(--margin) md:grid-cols-12 md:items-end">
        <h2 id="budgets-heading" data-reveal className="text-head md:col-span-7">
          Three budgets
        </h2>
        <p data-reveal style={{ "--d": "80ms" } as React.CSSProperties} className="max-w-[40ch] md:col-span-4 md:col-start-9">
          Like a look but not its price? Wingman rebuilds it from cheaper or dearer stores, keeping the colour and the
          cut, and tries each version on you.
        </p>
      </div>

      {/* Side by side at every width: the comparison is the point, so all three stay in view */}
      <ul className="mt-12 grid grid-cols-3 gap-1 px-(--margin) md:mt-16 md:px-0">
        {BUDGETS.map((b, i) => (
          <li key={b.tier} className="min-w-0">
            <div data-shutter style={{ "--d": `${i * 110}ms` } as React.CSSProperties} className="relative aspect-[3/5] overflow-hidden bg-background md:aspect-[4/5]">
              <Image
                src={b.render}
                alt={`The model in the ${b.tier.toLowerCase()} version: ${b.piece.name} from ${b.piece.store}`}
                fill
                sizes="33vw"
                className="object-cover object-[50%_32%]"
              />
            </div>
            <div data-reveal style={{ "--d": `${120 + i * 110}ms` } as React.CSSProperties} className="pt-4 md:px-(--margin) md:pt-5">
              <p className="flex flex-col gap-1 md:gap-3">
                <span className="text-small md:text-lead">{b.tier}</span>
                <span className="text-lead tabular-nums md:font-display md:text-head md:leading-none">{sgd(b.piece.price, { whole: true })}</span>
              </p>
              <a href={b.piece.url} target="_blank" rel="noopener" className="text-link mt-2 inline-block text-small md:text-body">
                {b.piece.name}, {b.piece.store}
              </a>
            </div>
          </li>
        ))}
      </ul>

      <div data-reveal className="mt-14 px-(--margin) md:mt-20">
        <Link href="/style" className="btn w-full md:w-auto">
          Compare your own looks
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
